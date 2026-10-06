'use server';

import { revalidatePath } from 'next/cache';
import { exportEdited, isNew, loadSource, saveEdited } from '@/lib/canvas';
import { clearDraft, saveDraft } from '@/lib/canvas-claude';
import type { Edits, FillPlan } from '@/lib/canvas-shared';
import { MissingRequired, prepareFill } from '@/lib/renderer';
import { currentUser } from '@/lib/team';

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

async function run<T>(id: string, fn: (me: { id: string; is_admin: boolean }, piece: NonNullable<Awaited<ReturnType<typeof loadSource>>>) => Promise<T>): Promise<Result<T>> {
  try {
    const me = await currentUser();
    if (!me) throw new Error('Sign in again.');
    const piece = await loadSource(id);
    if (!piece) throw new Error('Piece not found.');
    return { ok: true, ...(await fn(me, piece)) };
  } catch (e) {
    if (e instanceof MissingRequired) return { ok: false, error: `This piece cannot go without ${e.slots.join(', ')}.` };
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

export async function exportAction(id: string, slots: Record<string, string | null>, edits: Edits) {
  return run(id, async (_me, piece) => ({ url: await exportEdited(piece, slots, edits) }));
}

export async function saveAction(id: string, slots: Record<string, string | null>, edits: Edits, mode: 'version' | 'replace') {
  return run(id, async (me, piece) => {
    const saved = await saveEdited(me, piece, slots, edits, mode);
    if (!isNew(piece)) await clearDraft(piece.id);
    revalidatePath('/', 'layout');
    return { id: saved.id, url: saved.url };
  });
}

// The work in progress, kept as people edit so Claude (through the MCP) works on what they see.
export async function saveDraftAction(id: string, slots: Record<string, string | null>, edits: Edits) {
  return run(id, async (me, piece) => {
    if (isNew(piece)) return { version: 0 };
    return { version: await saveDraft({ pieceId: piece.id, userId: me.id, slots, edits, by: 'app' }) };
  });
}
