'use server';

import { revalidatePath } from 'next/cache';
import { archiveSet, deleteSet, moveSet, renameSet, restoreSet } from '@/lib/sets';
import { currentUser } from '@/lib/team';

type Result = { ok: true } | { ok: false; error: string };

async function run(fn: (me: { id: string; is_admin: boolean }) => Promise<void>): Promise<Result> {
  try {
    const me = await currentUser();
    if (!me) throw new Error('Sign in again.');
    await fn(me);
    revalidatePath('/', 'layout'); // gallery, projects, archive, sidebar counts
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function moveSetAction(setId: string, projectId: string | null) { return run((me) => moveSet(me, setId, projectId)); }
export async function renameSetAction(setId: string, title: string) { return run((me) => renameSet(me, setId, title)); }
export async function archiveSetAction(setId: string) { return run((me) => archiveSet(me, setId)); }
export async function restoreSetAction(setId: string) { return run((me) => restoreSet(me, setId)); }
export async function deleteSetAction(setId: string) { return run((me) => deleteSet(me, setId)); }
