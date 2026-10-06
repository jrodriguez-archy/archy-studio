'use server';

import { revalidatePath } from 'next/cache';
import { createProject, deleteProject, movePiece, updateProject } from '@/lib/projects';
import { currentUser } from '@/lib/team';

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function run<T>(fn: (me: { id: string; is_admin: boolean }) => Promise<T>): Promise<Result<T>> {
  try {
    const me = await currentUser();
    if (!me) throw new Error('Sign in again.');
    const data = await fn(me);
    revalidatePath('/', 'layout'); // sidebar counts, gallery and project pages
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createProjectAction(name: string, shared: boolean) {
  return run(async (me) => (await createProject(me, name, shared)).id);
}
export async function renameProjectAction(id: string, name: string) { return run((me) => updateProject(me, id, { name })); }
export async function shareProjectAction(id: string, shared: boolean) { return run((me) => updateProject(me, id, { shared })); }
export async function deleteProjectAction(id: string) { return run((me) => deleteProject(me, id)); }
export async function movePieceAction(renderId: string, projectId: string | null) { return run((me) => movePiece(me, renderId, projectId)); }
