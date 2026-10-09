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

// Several sets at once (Archive's selection). Each set keeps its own permission check; the ones that
// fail are counted, the rest go through.
type BulkResult = { ok: boolean; done: number; failed: number; error?: string };
const SET_ID = /^[0-9a-f-]{36}$/i;

async function bulk(ids: string[], fn: (me: { id: string; is_admin: boolean }, id: string) => Promise<void>): Promise<BulkResult> {
  const me = await currentUser();
  if (!me) return { ok: false, done: 0, failed: 0, error: 'Sign in again.' };
  const list = Array.isArray(ids) ? [...new Set(ids)].filter((id) => typeof id === 'string' && SET_ID.test(id)).slice(0, 200) : [];
  let done = 0, failed = 0, error: string | undefined;
  for (let i = 0; i < list.length; i += 5) {
    const results = await Promise.allSettled(list.slice(i, i + 5).map((id) => fn(me, id)));
    for (const r of results) {
      if (r.status === 'fulfilled') done++;
      else { failed++; error ??= (r.reason as Error).message; }
    }
  }
  if (done) revalidatePath('/', 'layout');
  return { ok: failed === 0, done, failed, error };
}

export async function archiveSetsAction(ids: string[]) { return bulk(ids, archiveSet); }
export async function restoreSetsAction(ids: string[]) { return bulk(ids, restoreSet); }
export async function deleteSetsAction(ids: string[]) { return bulk(ids, deleteSet); }
