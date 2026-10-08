import 'server-only';
import { randomUUID } from 'node:crypto';
import { cleanEdits, type Edits } from './canvas-shared';
import { canReplace, isNew, type PieceSource } from './canvas';
import { render } from './renderer';
import { replaceRender, saveRender, storeExport } from './renders';

// Canvas exports and saves: the piece rendered again with Chromium at 2x. Only the /api/canvas route
// (and the MCP) import this, so the Canvas page itself stays light.

type Who = { id: string; is_admin: boolean };

// Render the edited piece at 2x. Copy that does not fit is refused, as in the MCP.
async function renderEdited(piece: PieceSource, slots: Record<string, string | null>, edits: Edits) {
  // Nothing blocks a save: the Inspector suggests, the person decides.
  return render({ template: piece.template, format: piece.format, design: piece.design, theme: piece.theme, slots: pick(piece, slots), edits: cleanEdits(edits), scale: 2 });
}

// Only the slots the template has (the client cannot add others).
function pick(piece: PieceSource, slots: Record<string, string | null>) {
  return Object.fromEntries(Object.keys({ ...piece.slots, ...slots }).map((k) => [k, slots[k] ?? null]));
}

export async function exportEdited(piece: PieceSource, slots: Record<string, string | null>, edits: Edits) {
  const out = await renderEdited(piece, slots, edits);
  return storeExport(out.png, `${[piece.template, piece.design, piece.theme, piece.format].filter(Boolean).join('-')}.png`);
}

// A new design joins `set` when given (a format added to an existing set); otherwise it starts its own.
type SetOf = { id: string; projectId: string | null; title: string | null };

export async function saveEdited(me: Who, piece: PieceSource, slots: Record<string, string | null>, edits: Edits, mode: 'version' | 'replace', set?: SetOf) {
  const out = await renderEdited(piece, slots, edits);
  const clean = cleanEdits(edits);
  if (isNew(piece)) {
    // A piece started from a template: its own set (like a brief made with Claude), or a format added to one.
    const saved = await saveRender({
      userId: me.id, template: piece.template, format: piece.format, slots: out.slots, png: out.png, width: out.width, height: out.height, scale: 2,
      source: 'app', setId: set?.id ?? randomUUID(), projectId: set?.projectId ?? null, setTitle: set?.title ?? null, variant: out.variant, design: out.design, theme: out.theme, edits: clean,
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
    source: 'app', projectId: piece.project_id, setId: piece.set_id ?? piece.id, setTitle: piece.set_title, variant: out.variant, design: out.design, theme: out.theme, edits: clean, parentId: piece.id,
  });
  if (!saved) throw new Error('Saving needs the gallery (Supabase) configured.');
  return saved;
}


// Save every artboard that changed (and every format added) in one go. Existing designs follow `mode`;
// added formats join the set of the designs they were made from (a new set when all are new).
export async function saveSet(me: Who, items: { piece: PieceSource; slots: Record<string, string | null>; edits: Edits }[], mode: 'version' | 'replace', from: PieceSource | null) {
  const base = from && !isNew(from) ? from : items.map((i) => i.piece).find((p) => !isNew(p)) ?? null;
  const set: SetOf = base ? { id: base.set_id ?? base.id, projectId: base.project_id, title: base.set_title } : { id: randomUUID(), projectId: null, title: null };
  if (mode === 'replace') {
    const refused = [];
    for (const i of items) if (!isNew(i.piece) && !(await canReplace(me, i.piece))) refused.push(i.piece.format);
    if (refused.length) throw new Error('Only the person who made it, the project owner or an admin can replace the original. Save it as a new version.');
  }
  return Promise.all(items.map(async (i) => ({ ref: i.piece.id, ...(await saveEdited(me, i.piece, i.slots, i.edits, mode, set)) })));
}
