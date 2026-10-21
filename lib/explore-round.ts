import type { Brand } from './brands';
import { displayName } from './names';
import { supabaseAdmin } from './supabase/admin';

// Exploration review (Admin → Review → Explorations): a round points at the team's explorations as
// they are, the newest of each format in each set. Nothing is drawn again. Used by the board's
// "New round" button and scripts/explore-round.ts.

export type ExplorationRow = {
  id: string; set_id: string | null; set_title: string | null; format: string; storage_path: string; width: number; height: number;
  user_id: string | null; parent_id: string | null; created_at: string;
};

/** The newest render of each format in each set, leaving out what a round already has (and the Canvas
 *  corrections of those). Sets come newest first. */
export function pickExplorations(rows: ExplorationRow[], reviewed: Set<string>): ExplorationRow[] {
  const newest = new Map<string, ExplorationRow>();
  for (const r of rows) {
    if (reviewed.has(r.id) || (r.parent_id && reviewed.has(r.parent_id))) continue;
    const key = `${r.set_id ?? r.id}|${r.format}`;
    const had = newest.get(key);
    if (!had || r.created_at > had.created_at) newest.set(key, r);
  }
  const picked = [...newest.values()];
  const setAt = new Map<string, string>();
  for (const r of picked) { const s = r.set_id ?? r.id; if (r.created_at > (setAt.get(s) ?? '')) setAt.set(s, r.created_at); }
  return picked.sort((a, b) => setAt.get(b.set_id ?? b.id)!.localeCompare(setAt.get(a.set_id ?? a.id)!) || a.format.localeCompare(b.format));
}

export const MIGRATION_HINT = 'Apply supabase/migrations/20261028000000_exploration_review.sql first.';
// A column the migration adds is missing (Postgres 42703, or PostgREST's schema cache PGRST204).
export const missingColumn = (e: { code?: string; message?: string } | null) => !!e && (e.code === '42703' || e.code === 'PGRST204' || /column .*kind|render_id/.test(e.message ?? ''));

export async function createExplorationRound(opts: { since?: string; brand?: Brand; note?: string | null } = {}) {
  const db = supabaseAdmin();
  const { data: last, error: lastError } = await db.from('review_rounds').select('id, number, created_at').eq('kind', 'exploration').order('number', { ascending: false }).limit(1).maybeSingle();
  if (missingColumn(lastError)) throw new Error(MIGRATION_HINT);
  if (lastError) throw new Error(lastError.message);
  // By default: what was made since the last round (or in the last two weeks).
  const since = opts.since ?? last?.created_at ?? new Date(Date.now() - 14 * 864e5).toISOString();
  let q = db.from('renders').select('id, set_id, set_title, format, storage_path, width, height, user_id, parent_id, created_at')
    .eq('template', 'exploration').is('archived_at', null).gte('created_at', since).order('created_at', { ascending: false }).limit(2000);
  if (opts.brand) q = q.eq('brand', opts.brand);
  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);
  const list = (rows ?? []) as ExplorationRow[];
  const ids = [...new Set(list.flatMap((r) => [r.id, r.parent_id].filter(Boolean) as string[]))];
  const reviewed = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from('review_items').select('render_id').in('render_id', ids.slice(i, i + 200));
    for (const d of data ?? []) if (d.render_id) reviewed.add(d.render_id);
  }
  const picked = pickExplorations(list, reviewed);
  if (!picked.length) return { id: null, number: null, count: 0 };

  const users = [...new Set(picked.map((r) => r.user_id).filter(Boolean) as string[])];
  const { data: people } = users.length ? await db.from('profiles').select('id, full_name, email').in('id', users) : { data: [] };
  const nameOf = new Map((people ?? []).map((p) => [p.id, displayName(p.full_name, p.email)]));
  const number = (last?.number ?? 0) + 1;
  const { data: round, error: roundError } = await db.from('review_rounds').insert({ kind: 'exploration', number, note: opts.note ?? null }).select('id').single();
  if (roundError) throw new Error(missingColumn(roundError) ? MIGRATION_HINT : roundError.message);
  const items = picked.map((r) => {
    const requester = r.user_id ? nameOf.get(r.user_id) ?? 'Someone' : 'Claude';
    const title = r.set_title?.trim() || 'Untitled exploration';
    return {
      round_id: round.id, kind: 'exploration', template: 'exploration', format: r.format, case: `${title} · ${requester}`,
      slots: { set_id: r.set_id ?? r.id, set_title: title, requester }, edits: {}, storage_path: r.storage_path, width: r.width, height: r.height,
      report: {}, status: 'pending', render_id: r.id,
    };
  });
  const { error: itemsError } = await db.from('review_items').insert(items);
  if (itemsError) {
    await db.from('review_rounds').delete().eq('id', round.id);
    throw new Error(itemsError.message);
  }
  return { id: round.id as string, number, count: items.length };
}
