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
  return render({ template: piece.template, format: piece.format, slots: pick(piece, slots), edits: cleanEdits(edits), scale: 2 });
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

