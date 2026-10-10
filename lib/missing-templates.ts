import 'server-only';
import type { Brand } from './brands';
import { supabaseAdmin } from './supabase/admin';

// Briefs no template fits, kept by Claude (report_missing_template): the admin page groups them by what
// was asked for, so the most wanted templates show first.

export type MissingTemplate = {
  id: string; user_id: string | null; brand: Brand; piece: string; format: string | null;
  facts: string[]; purpose: string | null; offered: string[]; reason: string | null; created_at: string;
};

export async function reportMissing(userId: string | null, input: { brand: Brand; piece: string; format?: string | null; facts?: string[]; purpose?: string | null; offered?: string[]; reason?: string | null }) {
  const { error } = await supabaseAdmin().from('missing_templates').insert({
    user_id: userId, brand: input.brand, piece: input.piece.trim().slice(0, 200), format: input.format?.trim().slice(0, 80) || null,
    facts: input.facts ?? [], purpose: input.purpose ?? null, offered: input.offered ?? [], reason: input.reason?.trim().slice(0, 300) || null,
  });
  if (error) throw new Error(`Could not keep it: ${error.message}`);
}

export type MissingGroup = { key: string; piece: string; brand: Brand; count: number; last: string; formats: string[]; facts: string[]; offered: string[]; reasons: string[]; who: string[] };

// One row per kind of piece and brand (same words, any case), most asked for first.
export async function listMissing(): Promise<MissingGroup[]> {
  const db = supabaseAdmin();
  const { data } = await db.from('missing_templates').select('*').order('created_at', { ascending: false }).limit(1000);
  const rows = (data ?? []) as MissingTemplate[];
  const ids = [...new Set(rows.map((r) => r.user_id).filter((id): id is string => !!id))];
  const { data: people } = ids.length ? await db.from('profiles').select('id, email').in('id', ids) : { data: [] };
  const nameOf = new Map((people ?? []).map((p: { id: string; email: string }) => [p.id, p.email.split('@')[0]]));
  const groups = new Map<string, MissingGroup>();
  const add = (list: string[], v: string | null | undefined) => { if (v && !list.includes(v)) list.push(v); };
  for (const r of rows) {
    const key = `${r.brand}:${r.piece.toLowerCase().replace(/\s+/g, ' ').trim()}`;
    const g = groups.get(key) ?? { key, piece: r.piece, brand: r.brand, count: 0, last: r.created_at, formats: [], facts: [], offered: [], reasons: [], who: [] };
    g.count++;
    add(g.formats, r.format);
    r.facts.forEach((f) => add(g.facts, f));
    r.offered.forEach((t) => add(g.offered, t));
    add(g.reasons, r.reason);
    add(g.who, r.user_id ? nameOf.get(r.user_id) : null);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || b.last.localeCompare(a.last));
}
