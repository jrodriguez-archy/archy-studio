import 'server-only';
import { titleOf } from './catalog';
import { loadManifest } from './templates';
import { formatLabel } from './gallery-shared';
import { largeUrl, thumbUrl } from './images';
import { supabaseAdmin } from './supabase/admin';

// Template review (Admin → Template review): rounds of example designs, every template × format × case,
// that an admin approves or comments on. Claude generates the rounds (scripts/review-round.ts), reads the
// comments (scripts/review-feedback.ts), fixes and resolves them; the next round shows before/after.

export type ReviewStatus = 'pending' | 'approved' | 'needs_work';
export type ReviewComment = { id: string; body: string; x: number | null; y: number | null; author: string; created_at: string; resolved_at: string | null; resolution: string | null };
export type ReviewItem = {
  id: string; template: string; title: string; format: string; formatLabel: string; case: string; status: ReviewStatus;
  width: number; height: number; url: string; thumb: string;
  /** The same design in the round before: its image when it changed (before/after), and its comments. */
  prev: { url: string | null; comments: ReviewComment[] } | null;
  report: { ok?: boolean; errors?: { slot?: string; code: string; message?: string }[]; fill?: Record<string, unknown>; review?: { title: string; level: string }[]; trimmed?: string[] };
  comments: ReviewComment[];
};
export type ReviewRound = { id: string; number: number; note: string | null; created_at: string };

export async function listRounds(): Promise<ReviewRound[]> {
  const { data } = await supabaseAdmin().from('review_rounds').select('id, number, note, created_at').order('number', { ascending: false });
  return (data ?? []) as ReviewRound[];
}

type Row = { id: string; template: string; format: string; case: string; status: ReviewStatus; width: number; height: number; storage_path: string; report: ReviewItem['report']; prev_item_id: string | null };
type CommentRow = { id: string; item_id: string; body: string; x: number | null; y: number | null; created_at: string; resolved_at: string | null; resolution: string | null; profiles: { full_name: string | null; email: string } | null };

export async function loadRound(roundId: string): Promise<ReviewItem[]> {
  const db = supabaseAdmin();
  const { data } = await db.from('review_items').select('id, template, format, case, status, width, height, storage_path, report, prev_item_id').eq('round_id', roundId);
  const rows = (data ?? []) as Row[];
  const prevIds = rows.map((r) => r.prev_item_id).filter(Boolean) as string[];
  const { data: prevRows } = prevIds.length ? await db.from('review_items').select('id, storage_path').in('id', prevIds) : { data: [] };
  const prevPath = Object.fromEntries((prevRows ?? []).map((p) => [p.id, p.storage_path as string]));
  const { data: cRows } = await db.from('review_comments').select('id, item_id, body, x, y, created_at, resolved_at, resolution, profiles(full_name, email)')
    .in('item_id', [...rows.map((r) => r.id), ...prevIds]).order('created_at');
  const comments = new Map<string, ReviewComment[]>();
  for (const c of (cRows ?? []) as unknown as CommentRow[]) {
    comments.set(c.item_id, [...(comments.get(c.item_id) ?? []), {
      id: c.id, body: c.body, x: c.x, y: c.y, created_at: c.created_at, resolved_at: c.resolved_at, resolution: c.resolution,
      // A comment without a person is a suggestion Claude drafted for the admin to keep, edit or delete.
      author: c.profiles?.full_name ?? c.profiles?.email ?? 'Claude (suggestion)',
    }]);
  }
  const titles = Object.fromEntries(await Promise.all([...new Set(rows.map((r) => r.template))].map(async (t) => [t, await titleOf(t)])));
  const rank = (f: string) => { const i = ['post', 'square', 'stories', 'og', 'cover'].indexOf(f.split('--')[0]); return i < 0 ? 9 : i; };
  // "post--the-arch--navy" → "Post · The Arch, Navy" (another design and theme of the template).
  const manifests = Object.fromEntries(await Promise.all([...new Set(rows.map((r) => r.template))].map(async (t) => [t, await loadManifest(t).catch(() => null)])));
  const labelOf = (template: string, f: string) => {
    const [plain, design, theme] = f.split('--');
    const m = manifests[template];
    return design ? `${formatLabel(plain)} · ${m?.designs?.[design]?.label ?? design}, ${m?.themes?.[theme]?.label ?? theme}` : formatLabel(f);
  };
  rows.sort((a, b) => rank(a.format) - rank(b.format) || a.case.localeCompare(b.case));
  return rows.map((r) => ({
    id: r.id, template: r.template, title: titles[r.template] ?? r.template, format: r.format, formatLabel: labelOf(r.template, r.format), case: r.case, status: r.status,
    width: r.width, height: r.height, url: largeUrl(r.storage_path), thumb: thumbUrl(r.storage_path), report: r.report ?? {},
    prev: r.prev_item_id && prevPath[r.prev_item_id] ? { url: prevPath[r.prev_item_id] !== r.storage_path ? largeUrl(prevPath[r.prev_item_id]) : null, comments: comments.get(r.prev_item_id) ?? [] } : null,
    comments: comments.get(r.id) ?? [],
  }));
}

export async function setStatus(itemId: string, status: ReviewStatus) {
  const { error } = await supabaseAdmin().from('review_items').update({ status, reviewed_at: new Date().toISOString() }).eq('id', itemId);
  if (error) throw new Error(error.message);
}

// Comments on one or several designs at once (the same comment on every format, or comments pasted
// from another design). Returns the new ids per design, in order.
export async function addComments(userId: string, rows: { itemId: string; body: string; x: number | null; y: number | null }[]) {
  if (!rows.length) return {} as Record<string, string[]>;
  const db = supabaseAdmin();
  const { data, error } = await db.from('review_comments')
    .insert(rows.map((r) => ({ item_id: r.itemId, user_id: userId, body: r.body, x: r.x, y: r.y }))).select('id, item_id');
  if (error) throw new Error(error.message);
  // A comment means it needs work (unless it is already approved on purpose).
  await db.from('review_items').update({ status: 'needs_work', reviewed_at: new Date().toISOString() }).in('id', [...new Set(rows.map((r) => r.itemId))]).neq('status', 'approved');
  const out: Record<string, string[]> = {};
  for (const d of data ?? []) (out[d.item_id] ??= []).push(d.id);
  return out;
}

export async function addComment(userId: string, itemId: string, body: string, point: { x: number; y: number } | null) {
  return (await addComments(userId, [{ itemId, body, x: point?.x ?? null, y: point?.y ?? null }]))[itemId][0];
}

// A pin moved to the right spot (after copying it from another format).
export async function moveComment(commentId: string, x: number, y: number) {
  const { error } = await supabaseAdmin().from('review_comments').update({ x, y }).eq('id', commentId).is('resolved_at', null);
  if (error) throw new Error(error.message);
}

export async function deleteComment(commentId: string) {
  const { error } = await supabaseAdmin().from('review_comments').delete().eq('id', commentId).is('resolved_at', null);
  if (error) throw new Error(error.message);
}
