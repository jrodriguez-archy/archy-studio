import 'server-only';
import { supabaseAdmin } from './supabase/admin';

// Projects organise pieces like folders. Shared projects are visible to the whole team; personal ones
// only to their owner. Anyone can file their own pieces into a project they can see; the owner (or an
// admin) renames or deletes it. Deleting a project keeps its pieces (they go back to no project).

export type Project = { id: string; name: string; shared: boolean; owner_id: string; owner: string | null; count: number };
type Who = { id: string; is_admin: boolean };

const clean = (name: string) => name.trim().replace(/\s+/g, ' ').slice(0, 80);

export async function listProjects(me: Who): Promise<Project[]> {
  const { data } = await supabaseAdmin()
    .from('projects')
    .select('id, name, shared, owner_id, profiles(full_name, email), renders(set_id, archived_at)')
    .or(`shared.eq.true,owner_id.eq.${me.id}`)
    .order('name');
  type Row = { id: string; name: string; shared: boolean; owner_id: string; profiles: { full_name: string | null; email: string } | null; renders: { set_id: string | null; archived_at: string | null }[] };
  return ((data ?? []) as unknown as Row[]).map((p) => ({
    id: p.id, name: p.name, shared: p.shared, owner_id: p.owner_id,
    owner: p.profiles?.full_name ?? p.profiles?.email ?? null,
    count: new Set((p.renders ?? []).filter((r) => !r.archived_at).map((r) => r.set_id)).size, // live sets, not single formats
  }));
}

export async function getProject(me: Who, id: string): Promise<Project | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return (await listProjects(me)).find((p) => p.id === id) ?? null;
}

// By id or by name (case-insensitive), among the projects this person can see.
export async function findProject(me: Who, ref: string): Promise<Project | null> {
  const all = await listProjects(me);
  const key = clean(ref).toLowerCase();
  return all.find((p) => p.id === ref) ?? all.find((p) => p.name.toLowerCase() === key) ?? null;
}

export async function createProject(me: Who, name: string, shared: boolean): Promise<Project> {
  const n = clean(name);
  if (!n) throw new Error('Give the project a name.');
  const same = (await listProjects(me)).find((p) => p.name.toLowerCase() === n.toLowerCase());
  if (same) return same; // one name, one folder
  const { data, error } = await supabaseAdmin().from('projects').insert({ name: n, shared, owner_id: me.id }).select('id').single();
  if (error || !data) throw new Error(error?.message ?? 'Could not create the project.');
  return (await getProject(me, data.id))!;
}

async function owned(me: Who, id: string) {
  const p = await getProject(me, id);
  if (!p) throw new Error('Project not found.');
  if (p.owner_id !== me.id && !me.is_admin) throw new Error('Only the person who created the project can change it.');
  return p;
}

export async function updateProject(me: Who, id: string, patch: { name?: string; shared?: boolean }) {
  await owned(me, id);
  const next: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) {
    const n = clean(patch.name);
    if (!n) throw new Error('Give the project a name.');
    next.name = n;
  }
  if (patch.shared !== undefined) next.shared = patch.shared;
  const { error } = await supabaseAdmin().from('projects').update(next).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteProject(me: Who, id: string) {
  await owned(me, id);
  const { error } = await supabaseAdmin().from('projects').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
