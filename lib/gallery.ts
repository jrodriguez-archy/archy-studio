import 'server-only';
import { titleOf } from './catalog';
import { signedUrls, thumbPath } from './renders';
import { supabaseAdmin } from './supabase/admin';

import type { Piece } from './gallery-shared';

export { TYPES, canManageSet, formatLabel, groupSets, type Piece, type PieceSet } from './gallery-shared';

export async function loadPieces(filter: { userId?: string; projectId?: string; formats?: string[]; archived?: boolean }, limit = 240): Promise<Piece[]> {
  let q = supabaseAdmin()
    .from('renders')
    .select('id, set_id, set_title, archived_at, edited_at, template, format, storage_path, width, height, scale, slots, created_at, user_id, project_id, profiles!renders_user_id_fkey(email, full_name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  q = filter.archived ? q.not('archived_at', 'is', null) : q.is('archived_at', null);
  if (filter.userId) q = q.eq('user_id', filter.userId);
  if (filter.projectId) q = q.eq('project_id', filter.projectId);
  if (filter.formats) q = q.in('format', filter.formats);
  type Row = { id: string; set_id: string | null; set_title: string | null; archived_at: string | null; edited_at: string | null; template: string; format: string; storage_path: string; width: number; height: number; scale: number; slots: Record<string, string | null>; created_at: string; user_id: string | null; project_id: string | null; profiles: { email: string; full_name: string | null } | null };
  const rows = ((await q).data ?? []) as unknown as Row[];
  const [thumbs, files] = await Promise.all([signedUrls(rows.map((r) => thumbPath(r.storage_path))), signedUrls(rows.map((r) => r.storage_path), 60 * 60, true)]);
  const titles = Object.fromEntries(await Promise.all([...new Set(rows.map((r) => r.template))].map(async (t) => [t, await titleOf(t)])));
  return rows.map((r) => ({
    id: r.id, set_id: r.set_id ?? r.id, set_title: r.set_title, archived_at: r.archived_at, edited_at: r.edited_at, template: r.template, title: titles[r.template], format: r.format, width: r.width, height: r.height, scale: r.scale, slots: r.slots ?? {}, created_at: r.created_at,
    user_id: r.user_id, author: r.profiles?.full_name ?? 'Studio', project_id: r.project_id,
    thumb: thumbs[thumbPath(r.storage_path)] ?? files[r.storage_path], file: files[r.storage_path],
  }));
}

