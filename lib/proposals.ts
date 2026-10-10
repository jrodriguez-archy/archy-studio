import 'server-only';
import { brandOf, type Brand } from './brands';
import { thumbUrl } from './images';
import { displayName } from './names';
import { supabaseAdmin } from './supabase/admin';

// Template proposals: an exploration someone thinks should become a template. Anyone proposes from the
// set's menu; admins follow them up in Admin › Template proposals. One proposal per set; proposing again
// adds the note.

export const STATUSES = ['proposed', 'in-progress', 'done', 'dismissed'] as const;
export type ProposalStatus = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<ProposalStatus, string> = { proposed: 'Proposed', 'in-progress': 'Making it', done: 'Done', dismissed: 'Dismissed' };

const ID = /^[0-9a-f-]{36}$/i;

export async function propose(userId: string, setId: string, note?: string | null) {
  if (!ID.test(setId)) throw new Error('Design not found.');
  const db = supabaseAdmin();
  // The set's newest exploration leads the card.
  const { data: lead } = await db.from('renders').select('id, brand, template').or(`set_id.eq.${setId},id.eq.${setId}`).is('archived_at', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!lead) throw new Error('Design not found.');
  if (lead.template !== 'exploration') throw new Error('Only explorations can be proposed as templates.');
  const clean = note?.trim().slice(0, 300) || null;
  const { data: open } = await db.from('template_proposals').select('id, note').eq('set_id', setId).maybeSingle();
  if (open) {
    const merged = [open.note, clean].filter(Boolean).join(' · ') || null;
    const { error } = await db.from('template_proposals').update({ note: merged, status: 'proposed', updated_at: new Date().toISOString() }).eq('id', open.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await db.from('template_proposals').insert({ set_id: setId, render_id: lead.id, brand: brandOf(lead.brand), proposed_by: userId, note: clean });
  if (error) throw new Error(error.message);
}

export async function setProposalStatus(id: string, status: ProposalStatus) {
  if (!ID.test(id) || !STATUSES.includes(status)) throw new Error('Unknown proposal.');
  const { error } = await supabaseAdmin().from('template_proposals').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

/** The sets of these ids that are already proposed (open, in progress or done). */
export async function proposedSets(setIds: string[]): Promise<Set<string>> {
  const ids = setIds.filter((i) => ID.test(i));
  if (!ids.length) return new Set();
  const { data } = await supabaseAdmin().from('template_proposals').select('set_id, status').in('set_id', ids).neq('status', 'dismissed');
  return new Set((data ?? []).map((r) => r.set_id as string));
}

export type Proposal = {
  id: string; setId: string; status: ProposalStatus; note: string | null; createdAt: string; by: string;
  title: string; formats: string[]; thumb: string | null; width: number; height: number;
};

export async function listProposals(brand: Brand, status: ProposalStatus): Promise<Proposal[]> {
  const db = supabaseAdmin();
  const { data } = await db.from('template_proposals').select('id, set_id, render_id, status, note, created_at, proposed_by')
    .eq('brand', brand).eq('status', status).order('created_at', { ascending: false }).limit(200);
  const rows = data ?? [];
  if (!rows.length) return [];
  const [renders, people] = await Promise.all([
    db.from('renders').select('id, set_id, set_title, format, storage_path, width, height, created_at').in('set_id', rows.map((r) => r.set_id)).is('archived_at', null),
    db.from('profiles').select('id, email, full_name').in('id', rows.map((r) => r.proposed_by).filter(Boolean)),
  ]);
  const who = new Map((people.data ?? []).map((p) => [p.id, displayName(p.full_name, p.email)]));
  return rows.map((r) => {
    const set = (renders.data ?? []).filter((x) => x.set_id === r.set_id);
    const lead = set.find((x) => x.id === r.render_id) ?? set[0];
    return {
      id: r.id, setId: r.set_id, status: r.status as ProposalStatus, note: r.note, createdAt: r.created_at, by: r.proposed_by ? who.get(r.proposed_by) ?? 'Someone' : 'Someone',
      title: lead?.set_title ?? 'Exploration', formats: [...new Set(set.map((x) => x.format))], thumb: lead ? thumbUrl(lead.storage_path) : null,
      width: lead?.width ?? 1080, height: lead?.height ?? 1350,
    };
  });
}
