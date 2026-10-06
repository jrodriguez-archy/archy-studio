import 'server-only';
import { randomUUID } from 'node:crypto';
import { catalog } from './catalog';
import { formatLabel as fmt, groupSets } from './gallery-shared';
import { loadPieces } from './gallery';
import { titleOf } from './catalog';
import { cleanEdits, type Edits } from './canvas-shared';
import { formatLabel } from './gallery-shared';
import { render } from './renderer';
import { replaceRender, saveRender, storeExport } from './renders';
import { supabaseAdmin } from './supabase/admin';
import { loadConfig, loadLibrary, loadManifest } from './templates';

// Canvas: open a finished piece from its source (template + format + slots + edits), change it by hand
// and render it again with the same engine. Anyone on the team can open a piece and save a new version
// of it; replacing the original is for whoever can manage its set (maker, project owner, admin).

type Who = { id: string; is_admin: boolean };

export type PieceSource = {
  id: string; template: string; format: string; slots: Record<string, string | null>; edits: Edits;
  set_id: string | null; set_title: string | null; project_id: string | null; user_id: string | null; storage_path: string;
  width: number; height: number;
};

// What Canvas opens: a saved piece (its id) or a new piece from a template ("new:<template>:<format>",
// drawn with the template's sample copy; saving it makes a new piece and set).
export const newRef = (template: string, format: string) => `new:${template}:${format}`;

export async function loadSource(ref: string): Promise<PieceSource | null> {
  const fresh = ref.match(/^new:([a-z0-9-]+):([a-z]+)$/);
  if (fresh) {
    const [, template, format] = fresh;
    const manifest = await loadManifest(template).catch(() => null);
    const f = manifest?.formats[format];
    if (!manifest || !f) return null;
    const slots = Object.fromEntries(Object.entries(manifest.slots).map(([k, v]) => [k, v.default]));
    return { id: ref, template, format, slots, edits: {}, set_id: null, set_title: null, project_id: null, user_id: null, storage_path: '', width: f.width, height: f.height };
  }
  const id = ref;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabaseAdmin().from('renders')
    .select('id, template, format, slots, edits, set_id, set_title, project_id, user_id, storage_path, width, height')
    .eq('id', id).maybeSingle();
  if (!data) return null;
  return { ...(data as PieceSource), slots: data.slots ?? {}, edits: data.edits ?? {} };
}

export const isNew = (piece: PieceSource) => piece.id.startsWith('new:');

export async function canReplace(me: Who, piece: PieceSource) {
  if (isNew(piece)) return false;
  if (me.is_admin || piece.user_id === me.id) return true;
  if (!piece.project_id) return false;
  const { data } = await supabaseAdmin().from('projects').select('owner_id').eq('id', piece.project_id).maybeSingle();
  return data?.owner_id === me.id;
}

// What the editor needs to know about each slot of this format: its kind, whether it can be empty and
// its size limits.
export type SlotInfo = { type: 'text' | 'image' | 'logo'; optional: boolean; fontSize?: { min: number; max: number } };

export async function editorContext(piece: PieceSource) {
  const [manifest, config, library, title] = await Promise.all([loadManifest(piece.template), loadConfig(piece.template), loadLibrary(), titleOf(piece.template)]);
  const optional = new Set(config.optional ?? []);
  const slots: Record<string, SlotInfo> = Object.fromEntries(Object.entries(manifest.slots).map(([k, s]) => [k, {
    type: s.type, optional: optional.has(k), fontSize: s.limits?.[piece.format]?.fontSize,
  }]));
  return {
    title, formatLabel: formatLabel(piece.format), slots,
    library: library.map((a) => ({ id: a.id, title: a.title, kind: a.kind, url: `/api/template-files/library/${a.file}` })),
  };
}

// Render the edited piece at 2x. Copy that does not fit is refused, as in the MCP.
async function renderEdited(piece: PieceSource, slots: Record<string, string | null>, edits: Edits) {
  const out = await render({ template: piece.template, format: piece.format, slots: pick(piece, slots), edits: cleanEdits(edits), scale: 2 });
  if (!out.report.ok) throw new Error(out.report.errors.map((e) => e.message ?? e.code).join(' '));
  return out;
}

// Only the slots the template has (the client cannot add others).
function pick(piece: PieceSource, slots: Record<string, string | null>) {
  return Object.fromEntries(Object.keys({ ...piece.slots, ...slots }).map((k) => [k, slots[k] ?? null]));
}

export async function exportEdited(piece: PieceSource, slots: Record<string, string | null>, edits: Edits) {
  const out = await renderEdited(piece, slots, edits);
  return storeExport(out.png, `${piece.template}-${piece.format}.png`);
}

export async function saveEdited(me: Who, piece: PieceSource, slots: Record<string, string | null>, edits: Edits, mode: 'version' | 'replace') {
  const out = await renderEdited(piece, slots, edits);
  const clean = cleanEdits(edits);
  if (isNew(piece)) {
    // A piece started from a template: its own set, like a brief made with Claude.
    const saved = await saveRender({
      userId: me.id, template: piece.template, format: piece.format, slots: out.slots, png: out.png, width: out.width, height: out.height, scale: 2,
      source: 'app', setId: randomUUID(), variant: out.variant, edits: clean,
    });
    if (!saved) throw new Error('Saving needs the gallery (Supabase) configured.');
    return saved;
  }
  if (mode === 'replace') {
    if (!(await canReplace(me, piece))) throw new Error('Only the person who made it, the project owner or an admin can replace the original. Save it as a new version.');
    return replaceRender({ id: piece.id, storagePath: piece.storage_path, slots: out.slots, edits: clean, variant: out.variant, png: out.png, userId: me.id });
  }
  const saved = await saveRender({
    userId: me.id, template: piece.template, format: piece.format, slots: out.slots, png: out.png, width: out.width, height: out.height, scale: 2,
    source: 'app', projectId: piece.project_id, setId: piece.set_id ?? piece.id, setTitle: piece.set_title, variant: out.variant, edits: clean, parentId: piece.id,
  });
  if (!saved) throw new Error('Saving needs the gallery (Supabase) configured.');
  return saved;
}

// The Canvas panel: templates to start from, the pieces to open (mine and the team's), the approved
// images and the person's own uploads.
export async function canvasLibrary(me: Who) {
  const [items, mine, team, library, uploads] = await Promise.all([
    catalog(), loadPieces({ userId: me.id }, 80), loadPieces({}, 80), loadLibrary(), listUploads(me.id),
  ]);
  const card = (p: Awaited<ReturnType<typeof loadPieces>>[number], title: string) => ({ id: p.id, title, format: fmt(p.format), thumb: p.thumb ?? null, width: p.width, height: p.height, author: p.author });
  const pieces = (list: Awaited<ReturnType<typeof loadPieces>>) => groupSets(list).flatMap((s) => s.pieces.map((p) => card(p, s.title)));
  return {
    templates: items.map((i) => ({
      id: i.manifest.id, title: i.config.title, category: i.config.category ?? 'other', purpose: i.config.purpose ?? null, cover: !!i.config.coverOf,
      formats: Object.entries(i.manifest.formats).map(([key, f]) => ({ key, label: fmt(key), width: f.width, height: f.height })),
    })),
    mine: pieces(mine),
    team: pieces(team),
    images: library.map((a) => ({ value: `asset:${a.id}`, title: a.title, kind: a.kind, url: `/api/template-files/library/${a.file}` })),
    uploads,
  };
}
export type CanvasLibrary = Awaited<ReturnType<typeof canvasLibrary>>;

// Images this person brought (Canvas uploads, inline logos), newest first.
export async function listUploads(userId: string) {
  const db = supabaseAdmin().storage.from('uploads');
  const { data } = await db.list(userId, { limit: 60, sortBy: { column: 'created_at', order: 'desc' } });
  const paths = (data ?? []).filter((f) => f.name && !f.name.startsWith('.')).map((f) => `${userId}/${f.name}`);
  if (!paths.length) return [];
  const { data: signed } = await db.createSignedUrls(paths, 60 * 60);
  return (signed ?? []).filter((x) => x.signedUrl && x.path).map((x) => ({ value: `upload:${x.path}`, title: 'Upload', kind: 'upload', url: x.signedUrl as string }));
}
