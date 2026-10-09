import 'server-only';
import { cache } from 'react';
import { currentBrand } from './brand';
import type { Brand } from './brands';
import { supabaseAdmin } from './supabase/admin';

// Projects organise pieces like folders. Shared projects are visible to the whole team; personal ones
// only to their owner. Anyone can file their own pieces into a project they can see; the owner (or an
// admin) renames or deletes it. Deleting a project keeps its pieces (they go back to no project).
// Each project belongs to one brand and only shows there; without a brand, the one the person works in.

export type Project = { id: string; name: string; shared: boolean; owner_id: string; owner: string | null; count: number; brand: Brand };
type Who = { id: string; is_admin: boolean };

const clean = (name: string) => name.trim().replace(/\s+/g, ' ').slice(0, 80);

// Once per request, however many parts of the page ask (layout, page, menus).
export const listProjects = async (me: Who, brand?: Brand) => projectsOf(me.id, brand ?? (await currentBrand()));
const projectsOf = cache(loadProjects);

async function loadProjects(meId: string, brand: Brand): Promise<Project[]> {
  const db = supabaseAdmin();
  const [{ data }, { data: counts }] = await Promise.all([
    db.from('projects').select('id, name, shared, owner_id, profiles(full_name, email)').eq('brand', brand).or(`shared.eq.true,owner_id.eq.${meId}`).order('name'),
    // Live sets per project, counted in the database (not single formats, not archived).
    db.rpc('project_set_counts'),
  ]);
  type Row = { id: string; name: string; shared: boolean; owner_id: string; profiles: { full_name: string | null; email: string } | null };
  const rows = (data ?? []) as unknown as Row[];
  const sets = new Map(((counts ?? []) as { project_id: string; sets: number }[]).map((c) => [c.project_id, Number(c.sets)]));
  return rows.map((p) => ({
    id: p.id, name: p.name, shared: p.shared, owner_id: p.owner_id,
    owner: p.profiles?.full_name ?? p.profiles?.email ?? null,
    count: sets.get(p.id) ?? 0, brand,
  }));
}

export async function getProject(me: Who, id: string, brand?: Brand): Promise<Project | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return (await listProjects(me, brand)).find((p) => p.id === id) ?? null;
}

// By id or by name (case-insensitive), among the projects this person can see.
export async function findProject(me: Who, ref: string, brand?: Brand): Promise<Project | null> {
  const all = await listProjects(me, brand);
  const key = clean(ref).toLowerCase();
  return all.find((p) => p.id === ref) ?? all.find((p) => p.name.toLowerCase() === key) ?? null;
}

export async function createProject(me: Who, name: string, shared: boolean, brand?: Brand): Promise<Project> {
  const n = clean(name);
  if (!n) throw new Error('Give the project a name.');
  const b = brand ?? (await currentBrand());
  const same = (await listProjects(me, b)).find((p) => p.name.toLowerCase() === n.toLowerCase());
  if (same) return same; // one name, one folder
  const { data, error } = await supabaseAdmin().from('projects').insert({ name: n, shared, owner_id: me.id, brand: b }).select('id').single();
  if (error || !data) throw new Error(error?.message ?? 'Could not create the project.');
  return (await loadProjects(me.id, b)).find((p) => p.id === data.id)!; // fresh: the cached list is from before
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
