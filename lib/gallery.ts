import 'server-only';
import { titleOf } from './catalog';
import { displayName } from './names';
import { fileLink, largeUrl, thumbUrl } from './images';
import { supabaseAdmin } from './supabase/admin';

import { PAGE, type Piece, type PieceFilter } from './gallery-shared';

export { PAGE, TYPES, canManageSet, formatLabel, groupSets, type Piece, type PieceFilter, type PieceSet } from './gallery-shared';


export async function loadPieces(filter: PieceFilter & { before?: string; setId?: string }, limit = PAGE): Promise<Piece[]> {
  let q = supabaseAdmin()
    .from('renders')
    .select('id, set_id, set_title, archived_at, edited_at, template, format, design, theme, storage_path, width, height, scale, slots, created_at, user_id, project_id, profiles!renders_user_id_fkey(email, full_name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  q = filter.archived ? q.not('archived_at', 'is', null) : q.is('archived_at', null);
  if (filter.userId) q = q.eq('user_id', filter.userId);
  if (filter.projectId) q = q.eq('project_id', filter.projectId);
  if (filter.formats) q = q.in('format', filter.formats);
  if (filter.before) q = q.lt('created_at', filter.before);
  if (filter.setId) q = q.or(`set_id.eq.${filter.setId},id.eq.${filter.setId}`);
  type Row = { id: string; set_id: string | null; set_title: string | null; archived_at: string | null; edited_at: string | null; template: string; format: string; design: string | null; theme: string | null; storage_path: string; width: number; height: number; scale: number; slots: Record<string, string | null>; created_at: string; user_id: string | null; project_id: string | null; profiles: { email: string; full_name: string | null } | null };
  const rows = ((await q).data ?? []) as unknown as Row[];
  const titles = Object.fromEntries(await Promise.all([...new Set(rows.map((r) => r.template))].map(async (t) => [t, await titleOf(t)])));
  return rows.map((r) => ({
    id: r.id, set_id: r.set_id ?? r.id, set_title: r.set_title, archived_at: r.archived_at, edited_at: r.edited_at, template: r.template, title: titles[r.template], format: r.format, design: r.design, theme: r.theme, width: r.width, height: r.height, scale: r.scale, slots: r.slots ?? {}, created_at: r.created_at,
    user_id: r.user_id, author: r.profiles ? displayName(r.profiles.full_name, r.profiles.email) : 'Studio', project_id: r.project_id,
    // Stable links: the same URL on every visit, so the browser keeps them (no signing per page view).
    thumb: thumbUrl(r.storage_path), large: largeUrl(r.storage_path), file: fileLink(r.id) + (r.archived_at ? '?archived=1' : ''),
  }));
}

