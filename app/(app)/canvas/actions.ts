'use server';

import { canvasLibrary, isNew, loadSource } from '@/lib/canvas';
import type { Edits, FillPlan } from '@/lib/canvas-shared';
import { saveDraft } from '@/lib/drafts';
import { MissingRequired, prepareFill } from '@/lib/fill';
import { currentUser } from '@/lib/team';

// Light Canvas actions (no browser): the fill for the editor, the draft, the panel's library. Export
// and save render with Chromium and live in /api/canvas, so this page's function stays small.

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

async function run<T>(id: string, fn: (me: { id: string; is_admin: boolean }, piece: NonNullable<Awaited<ReturnType<typeof loadSource>>>) => Promise<T>): Promise<Result<T>> {
  try {
    const me = await currentUser();
    if (!me) throw new Error('Sign in again.');
    const piece = await loadSource(id);
    if (!piece) throw new Error('Design not found.');
    return { ok: true, ...(await fn(me, piece)) };
  } catch (e) {
    if (e instanceof MissingRequired) return { ok: false, error: `This design cannot go without ${e.slots.join(', ')}.` };
    return { ok: false, error: (e as Error).message };
  }
}

// The fill for the editor's page after the copy or a slot image changed (variant, fit limits, image URLs).
export async function prepareAction(id: string, slots: Record<string, string | null>, edits: Edits) {
  return run(id, async (_me, piece) => {
    const given = Object.fromEntries(Object.keys(piece.slots).map((k) => [k, slots[k] ?? null]));
    const plan: FillPlan = await prepareFill({ template: piece.template, format: piece.format, slots: given, edits }, '/api/template-files');
    return { plan };
  });
}

// The work in progress, kept as people edit so Claude (through the MCP) works on what they see.
export async function saveDraftAction(id: string, slots: Record<string, string | null>, edits: Edits) {
  return run(id, async (me, piece) => {
    if (isNew(piece)) return { version: 0 };
    return { version: await saveDraft({ pieceId: piece.id, userId: me.id, slots, edits, by: 'app' }) };
  });
}

// The panel's library (templates, pieces, images, uploads), loaded after the piece is on screen.
export async function libraryAction() {
  const me = await currentUser();
  if (!me) return null;
  return canvasLibrary(me);
}
