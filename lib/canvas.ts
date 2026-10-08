import 'server-only';
import { cache } from 'react';
import { catalog, titleOf } from './catalog';
import { previewSrcs } from './previews';
import type { Edits } from './canvas-shared';
import { loadPieces } from './gallery';
import { formatLabel, groupSets } from './gallery-shared';
import { supabaseAdmin } from './supabase/admin';
import { comboFormats, loadConfig, loadLibrary, loadManifest, resolveCombo, type Manifest } from './templates';

// Canvas: open a finished piece from its source (template + format + slots + edits), change it by hand
// and render it again with the same engine. Anyone on the team can open a piece and save a new version
// of it; replacing the original is for whoever can manage its set (maker, project owner, admin).

type Who = { id: string; is_admin: boolean };

export type PieceSource = {
  id: string; template: string; format: string; slots: Record<string, string | null>; edits: Edits;
  /** Design and theme of templates that offer several (null: the template's default). */
  design: string | null; theme: string | null;
  set_id: string | null; set_title: string | null; project_id: string | null; user_id: string | null; storage_path: string;
  width: number; height: number;
};

// What Canvas opens: a saved piece (its id) or a new piece from a template ("new:<template>:<format>",
// plus ":<design>:<theme>" on templates that offer several; drawn with the template's sample copy;
// saving it makes a new piece and set).
export const newRef = (template: string, format: string, design?: string | null, theme?: string | null) =>
  `new:${template}:${format}${design || theme ? `:${design ?? ''}:${theme ?? ''}` : ''}`;

// The files of a piece's design × theme (the base formats on single-design templates).
const filesOf = (manifest: Manifest, piece: { design: string | null; theme: string | null }) =>
  comboFormats(manifest, resolveCombo(manifest, piece.design, piece.theme));
// The design × theme a piece draws, with the defaults filled in ('' on single-design templates).
const comboKey = (manifest: Manifest, p: { design: string | null; theme: string | null }) =>
  manifest.default ? `${p.design || manifest.default.design}--${p.theme || manifest.default.theme}` : '';

const COLUMNS = 'id, template, format, slots, edits, design, theme, set_id, set_title, project_id, user_id, storage_path, width, height';

// Once per request (the page title and the page both ask).
export const loadSource = cache(async (ref: string): Promise<PieceSource | null> => {
  const fresh = ref.match(/^new:([a-z0-9-]+):([a-z]+)(?::([a-z0-9-]*):([a-z0-9-]*))?$/);
  if (fresh) {
    const [, template, format, design = null, theme = null] = fresh;
    const manifest = await loadManifest(template).catch(() => null);
    if (!manifest) return null;
    const pick = { design: design || null, theme: theme || null };
    let f;
    try { f = filesOf(manifest, pick)[format]; } catch { return null; }
    if (!f) return null;
    const slots = Object.fromEntries(Object.entries(manifest.slots).map(([k, v]) => [k, v.default]));
    return { id: ref, template, format, slots, edits: {}, ...pick, set_id: null, set_title: null, project_id: null, user_id: null, storage_path: '', width: f.width, height: f.height };
  }
  const id = ref;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabaseAdmin().from('renders').select(COLUMNS).eq('id', id).maybeSingle();
  if (!data) return null;
  return { ...(data as PieceSource), slots: data.slots ?? {}, edits: data.edits ?? {} };
});

export const isNew = (piece: PieceSource) => piece.id.startsWith('new:');

// The formats of a design, as artboards: the newest design of each format of the same template in its
// set (the piece itself for its own format), and the template's formats the set does not have yet.
export async function loadSet(piece: PieceSource) {
  const manifest = await loadManifest(piece.template);
  const files = filesOf(manifest, piece);
  const order = Object.keys(files);
  let siblings: PieceSource[] = [];
  if (!isNew(piece) && piece.set_id) {
    const { data } = await supabaseAdmin().from('renders')
      .select(`${COLUMNS}, created_at`)
      .eq('set_id', piece.set_id).eq('template', piece.template).is('archived_at', null)
      .order('created_at', { ascending: false });
    const seen = new Set([piece.format]);
    const mine = comboKey(manifest, piece);
    for (const r of data ?? []) {
      // Only the formats of the same design and theme (a set can hold options in several).
      if (seen.has(r.format) || !files[r.format] || comboKey(manifest, r) !== mine) continue;
      seen.add(r.format);
      siblings.push({ ...(r as PieceSource), slots: r.slots ?? {}, edits: r.edits ?? {} });
    }
  }
  siblings = [piece, ...siblings].sort((a, b) => order.indexOf(a.format) - order.indexOf(b.format));
  const have = new Set(siblings.map((p) => p.format));
  const missing = order.filter((f) => !have.has(f)).map((f) => ({
    ref: newRef(piece.template, f, piece.design, piece.theme), format: f, width: files[f].width, height: files[f].height,
    defaults: Object.fromEntries(Object.entries(manifest.slots).map(([k, v]) => [k, v.default])) as Record<string, string | null>,
  }));
  return { pieces: siblings, missing };
}

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
  const combo = resolveCombo(manifest, piece.design, piece.theme);
  const slotsOf = (format: string): Record<string, SlotInfo> => Object.fromEntries(Object.entries(manifest.slots).map(([k, s]) => [k, {
    type: s.type, optional: optional.has(k), fontSize: s.limits?.[combo?.key ? `${format}--${combo.key}` : format]?.fontSize,
  }]));
  return {
    title, formatLabel: formatLabel(piece.format), slots: slotsOf(piece.format),
    /** The same, for every format of the template (each artboard). */
    slotsByFormat: Object.fromEntries(Object.keys(comboFormats(manifest, combo)).map((f) => [f, slotsOf(f)])),
    /** The design and theme drawn, with the labels to show (null on single-design templates). */
    combo: combo ? { design: combo.design, theme: combo.theme, designLabel: manifest.designs![combo.design].label, themeLabel: manifest.themes![combo.theme].label } : null,
    library: library.map((a) => ({ id: a.id, title: a.title, kind: a.kind, url: `/api/template-files/library/${a.file}` })),
  };
}

// The Canvas panel: templates to start from, the pieces to open (mine and the team's), the approved
// images and the person's own uploads.
export async function canvasLibrary(me: Who) {
  const [items, mine, team, library, uploads, seen] = await Promise.all([
    catalog(), loadPieces({ userId: me.id }, 80), loadPieces({}, 80), loadLibrary(), listUploads(me.id),
    supabaseAdmin().from('profiles').select('mcp_seen_at').eq('id', me.id).maybeSingle(),
  ]);
  const srcs = await previewSrcs(items);
  const card = (p: Awaited<ReturnType<typeof loadPieces>>[number], title: string) => ({ id: p.id, title, format: formatLabel(p.format), thumb: p.thumb ?? null, width: p.width, height: p.height, author: p.author });
  const pieces = (list: Awaited<ReturnType<typeof loadPieces>>) => groupSets(list).flatMap((s) => s.pieces.map((p) => card(p, s.title)));
  return {
    templates: items.map((i) => ({
      id: i.manifest.id, title: i.config.title, category: i.config.category ?? 'other', purpose: i.config.purpose ?? null, cover: !!i.config.coverOf,
      formats: Object.entries(i.manifest.formats).map(([key, f]) => ({ key, label: formatLabel(key), width: f.width, height: f.height, src: srcs[`${i.manifest.id}/${key}`] })),
    })),
    mine: pieces(mine),
    team: pieces(team),
    images: library.map((a) => ({ value: `asset:${a.id}`, title: a.title, kind: a.kind, url: `/api/template-files/library/${a.file}` })),
    uploads,
    /** When this person last used the Archy Studio connector from Claude (null: never). */
    mcpSeenAt: (seen.data?.mcp_seen_at as string | null | undefined) ?? null,
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
