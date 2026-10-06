import 'server-only';
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

export async function loadSource(id: string): Promise<PieceSource | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabaseAdmin().from('renders')
    .select('id, template, format, slots, edits, set_id, set_title, project_id, user_id, storage_path, width, height')
    .eq('id', id).maybeSingle();
  if (!data) return null;
  return { ...(data as PieceSource), slots: data.slots ?? {}, edits: data.edits ?? {} };
}

export async function canReplace(me: Who, piece: PieceSource) {
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
