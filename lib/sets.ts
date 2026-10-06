import 'server-only';
import { thumbPath } from './renders';
import { supabaseAdmin } from './supabase/admin';
import { getProject } from './projects';

// A set is every piece made from one brief. People manage a set when they made it, when it sits in a
// project they own, or when they are an admin: they can move, rename, archive, restore and (once
// archived) delete it for good.

type Who = { id: string; is_admin: boolean };
type Row = { id: string; user_id: string | null; project_id: string | null; storage_path: string; archived_at: string | null };

async function load(setId: string): Promise<Row[]> {
  if (!/^[0-9a-f-]{36}$/i.test(setId)) throw new Error('Set not found.');
  const { data } = await supabaseAdmin().from('renders').select('id, user_id, project_id, storage_path, archived_at').eq('set_id', setId);
  if (!data?.length) throw new Error('Set not found.');
  return data as Row[];
}

async function projectOwner(rows: Row[]): Promise<string | null> {
  const pid = rows.find((r) => r.project_id)?.project_id;
  if (!pid) return null;
  const { data } = await supabaseAdmin().from('projects').select('owner_id').eq('id', pid).maybeSingle();
  return (data?.owner_id as string | undefined) ?? null;
}

async function manage(me: Who, setId: string) {
  const rows = await load(setId);
  const ok = me.is_admin || rows.every((r) => r.user_id === me.id) || (await projectOwner(rows)) === me.id;
  if (!ok) throw new Error('Only the person who made it, the project owner or an admin can change this.');
  return rows;
}

export async function moveSet(me: Who, setId: string, projectId: string | null) {
  await manage(me, setId);
  if (projectId && !(await getProject(me, projectId))) throw new Error('Project not found.');
  const { error } = await supabaseAdmin().from('renders').update({ project_id: projectId }).eq('set_id', setId);
  if (error) throw new Error(error.message);
}

export async function renameSet(me: Who, setId: string, title: string) {
  await manage(me, setId);
  const t = title.trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!t) throw new Error('Give it a name.');
  const { error } = await supabaseAdmin().from('renders').update({ set_title: t }).eq('set_id', setId);
  if (error) throw new Error(error.message);
}

export async function archiveSet(me: Who, setId: string) {
  await manage(me, setId);
  const { error } = await supabaseAdmin().from('renders').update({ archived_at: new Date().toISOString(), archived_by: me.id }).eq('set_id', setId);
  if (error) throw new Error(error.message);
}

export async function restoreSet(me: Who, setId: string) {
  await manage(me, setId);
  const { error } = await supabaseAdmin().from('renders').update({ archived_at: null, archived_by: null }).eq('set_id', setId);
  if (error) throw new Error(error.message);
}

// For good: the PNGs and thumbnails leave Storage, then the records. Only archived sets.
export async function deleteSet(me: Who, setId: string) {
  const rows = await manage(me, setId);
  if (rows.some((r) => !r.archived_at)) throw new Error('Archive it first.');
  const db = supabaseAdmin();
  const paths = rows.flatMap((r) => [r.storage_path, thumbPath(r.storage_path)]);
  const { error: se } = await db.storage.from('renders').remove(paths);
  if (se) throw new Error(`Could not delete the files: ${se.message}`);
  const { error } = await db.from('renders').delete().eq('set_id', setId);
  if (error) throw new Error(error.message);
}
