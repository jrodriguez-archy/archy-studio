import 'server-only';
import { titleOf } from './catalog';
import { loadManifest } from './templates';
import { formatLabel } from './gallery-shared';
import { largeUrl, thumbUrl } from './images';
import { MIGRATION_HINT, missingColumn } from './explore-round';
import { supabaseAdmin } from './supabase/admin';

// Template review (Admin → Template review): rounds of example designs, every template × format × case,
// that an admin approves or comments on. Claude generates the rounds (scripts/review-round.ts), reads the
// comments (scripts/review-feedback.ts), fixes and resolves them; the next round shows before/after.
// Exploration rounds (kind 'exploration', lib/explore-round.ts) point at the team's explorations as they
// are; a Canvas version saved of one afterwards (a child render) is its "after".

export type ReviewStatus = 'pending' | 'approved' | 'needs_work';
export type ReviewComment = { id: string; body: string; x: number | null; y: number | null; author: string; created_at: string; resolved_at: string | null; resolution: string | null };
export type ReviewItem = {
  id: string; template: string; title: string; format: string; formatLabel: string; case: string; status: ReviewStatus;
  width: number; height: number; url: string; thumb: string;
  /** The same design in the round before: its image when it changed (before/after), and its comments. */
  prev: { url: string | null; comments: ReviewComment[] } | null;
  report: { ok?: boolean; errors?: { slot?: string; code: string; message?: string }[]; fill?: Record<string, unknown>; review?: { title: string; level: string }[]; trimmed?: string[] };
  comments: ReviewComment[];
  /** Exploration rounds: who asked, the set, its Canvas link, the brief's reference image and the correction. */
  exploration?: ExplorationInfo;
};
export type ExplorationInfo = {
  renderId: string | null; setId: string; setTitle: string; requester: string; canvas: string | null;
  reference: string | null;
  after: { id: string; url: string; width: number; height: number; at: string } | null;
};
export type ReviewKind = 'template' | 'exploration';
export type ReviewRound = { id: string; number: number; note: string | null; created_at: string; kind: ReviewKind };

export async function listRounds(kind: ReviewKind = 'template'): Promise<ReviewRound[]> {
  const db = supabaseAdmin();
  const { data, error } = await db.from('review_rounds').select('id, number, note, created_at, kind').eq('kind', kind).order('number', { ascending: false });
  // Before the exploration_review migration every round is a template round.
  if (missingColumn(error)) {
    if (kind === 'exploration') return [];
    const { data: all } = await db.from('review_rounds').select('id, number, note, created_at').order('number', { ascending: false });
    return (all ?? []).map((r) => ({ ...r, kind: 'template' })) as ReviewRound[];
  }
  return (data ?? []) as ReviewRound[];
}
export { MIGRATION_HINT };

type Row = { id: string; template: string; format: string; case: string; status: ReviewStatus; width: number; height: number; storage_path: string; report: ReviewItem['report']; prev_item_id: string | null; slots: Record<string, unknown>; render_id?: string | null };
type CommentRow = { id: string; item_id: string; body: string; x: number | null; y: number | null; created_at: string; resolved_at: string | null; resolution: string | null; profiles: { full_name: string | null; email: string } | null };

export async function loadRound(round: Pick<ReviewRound, 'id' | 'kind' | 'created_at'>): Promise<ReviewItem[]> {
  const db = supabaseAdmin();
  const cols = 'id, template, format, case, status, width, height, storage_path, report, prev_item_id, slots';
  const { data } = await db.from('review_items').select(round.kind === 'exploration' ? `${cols}, render_id` : cols).eq('round_id', round.id);
  const rows = (data ?? []) as unknown as Row[];
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
  if (round.kind === 'exploration') return explorationItems(rows, comments, round.created_at);
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

const FORMAT_RANK = ['post', 'square', 'stories', 'og', 'cover'];

// Exploration items: no template to look up. Each one says who asked and for what, links to Canvas, and
// shows the newest Canvas version saved of it since the round began (the admin's correction).
async function explorationItems(rows: Row[], comments: Map<string, ReviewComment[]>, since: string): Promise<ReviewItem[]> {
  const db = supabaseAdmin();
  const renderIds = rows.map((r) => r.render_id).filter(Boolean) as string[];
  const { data: renders } = renderIds.length ? await db.from('renders').select('id, slots, storage_path, width, height, edited_at').in('id', renderIds) : { data: [] };
  const byRender = new Map((renders ?? []).map((r) => [r.id as string, r as { id: string; slots: Record<string, unknown> | null; storage_path: string; width: number; height: number; edited_at: string | null }]));
  // Versions of versions: follow each design down to its newest child (as Canvas's ?latest does).
  const root = new Map(renderIds.map((id) => [id, id]));
  const after = new Map<string, { id: string; storage_path: string; width: number; height: number; created_at: string }>();
  let frontier = renderIds;
  for (let depth = 0; depth < 5 && frontier.length; depth++) {
    const { data: kids } = await db.from('renders').select('id, parent_id, storage_path, width, height, created_at')
      .in('parent_id', frontier).is('archived_at', null).gt('created_at', since);
    frontier = [];
    for (const k of kids ?? []) {
      const top = root.get(k.parent_id as string)!;
      root.set(k.id, top);
      frontier.push(k.id);
      if (!after.has(top) || k.created_at > after.get(top)!.created_at) after.set(top, k);
    }
  }
  const sorted = [...rows].sort((a, b) => {
    const ra = FORMAT_RANK.indexOf(a.format), rb = FORMAT_RANK.indexOf(b.format);
    return (ra < 0 ? 9 : ra) - (rb < 0 ? 9 : rb) || a.format.localeCompare(b.format);
  });
  return sorted.map((r) => {
    const s = r.slots ?? {};
    const render = r.render_id ? byRender.get(r.render_id) : undefined;
    const ref = render?.slots?.reference as unknown;
    const reference = typeof ref === 'string' ? ref : (ref && typeof ref === 'object' && typeof (ref as { url?: unknown }).url === 'string' ? (ref as { url: string }).url : null);
    const child = r.render_id ? after.get(r.render_id) : undefined;
    // Saved over the original instead: the record itself now holds the corrected image.
    const replaced = !child && render && render.storage_path !== r.storage_path && render.edited_at && render.edited_at > since
      ? { id: render.id, storage_path: render.storage_path, width: render.width, height: render.height, created_at: render.edited_at } : null;
    const a = child ?? replaced;
    const setTitle = String(s.set_title ?? r.case);
    return {
      id: r.id, template: String(s.set_id ?? r.id), title: setTitle, format: r.format, formatLabel: formatLabel(r.format), case: r.case, status: r.status,
      width: r.width, height: r.height, url: largeUrl(r.storage_path), thumb: thumbUrl(r.storage_path), report: {}, prev: null,
      comments: comments.get(r.id) ?? [],
      exploration: {
        renderId: r.render_id ?? null, setId: String(s.set_id ?? r.id), setTitle, requester: String(s.requester ?? ''),
        canvas: r.render_id ? `/canvas/${r.render_id}` : null, reference: reference && /^(https?:|data:image\/|\/)/.test(reference) ? reference : null,
        after: a ? { id: a.id, url: largeUrl(a.storage_path), width: a.width, height: a.height, at: a.created_at } : null,
      },
    };
  });
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
