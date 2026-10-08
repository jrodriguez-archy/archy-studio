import 'server-only';
import { randomBytes } from 'node:crypto';
import { cache } from 'react';
import { supabaseAdmin } from './supabase/admin';
import { supabaseServer } from './supabase/server';

// Team access without email: an allowlist of @archy.com addresses. Each person creates their own
// password the first time; an admin can add or remove people and reset a password.

export const MIN_PASSWORD = 10;
const norm = (email: string) => email.trim().toLowerCase();

export type AccessStatus = 'not-allowed' | 'create-password' | 'sign-in';

async function userByEmail(email: string) {
  const db = supabaseAdmin();
  const { data } = await db.from('profiles').select('id, password_set, is_admin').eq('email', email).maybeSingle();
  return data as { id: string; password_set: boolean; is_admin: boolean } | null;
}

export async function accessStatus(rawEmail: string): Promise<AccessStatus> {
  const email = norm(rawEmail);
  const db = supabaseAdmin();
  const { data: allowed } = await db.from('allowed_emails').select('email').eq('email', email).maybeSingle();
  if (!allowed) return 'not-allowed';
  const user = await userByEmail(email);
  return user?.password_set ? 'sign-in' : 'create-password';
}

// First sign-in (or after a reset): set the person's own password.
export async function createPassword(rawEmail: string, password: string) {
  const email = norm(rawEmail);
  if (password.length < MIN_PASSWORD) throw new Error(`Use at least ${MIN_PASSWORD} characters.`);
  if ((await accessStatus(email)) !== 'create-password') throw new Error('This account already has a password, or the email is not on the team list.');
  const db = supabaseAdmin();
  const existing = await userByEmail(email);
  if (existing) {
    const { error } = await db.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw new Error(error.message);
  }
  await db.from('profiles').update({ password_set: true }).eq('email', email);
}

// Once per request (layout and page both ask).
export const currentUser = cache(async () => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return null;
  const { data: profile } = await supabaseAdmin().from('profiles').select('id, email, full_name, is_admin').eq('id', id).maybeSingle();
  return profile as { id: string; email: string; full_name: string | null; is_admin: boolean } | null;
});

async function requireAdmin() {
  const me = await currentUser();
  if (!me?.is_admin) throw new Error('Only admins can manage the team.');
  return me;
}

export type Member = { email: string; is_admin: boolean; status: 'active' | 'pending'; full_name: string | null; last_sign_in: string | null };

export async function listTeam(): Promise<Member[]> {
  await requireAdmin();
  const db = supabaseAdmin();
  const [{ data: allowed }, { data: profiles }, { data: users }] = await Promise.all([
    db.from('allowed_emails').select('email, is_admin').order('created_at'),
    db.from('profiles').select('email, full_name, password_set'),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const prof = new Map((profiles ?? []).map((p) => [p.email, p]));
  const last = new Map((users?.users ?? []).map((u) => [u.email?.toLowerCase(), u.last_sign_in_at ?? null]));
  return (allowed ?? []).map((a) => ({
    email: a.email, is_admin: a.is_admin, full_name: prof.get(a.email)?.full_name ?? null,
    status: prof.get(a.email)?.password_set ? 'active' : 'pending', last_sign_in: last.get(a.email) ?? null,
  }));
}

export async function addMember(rawEmail: string, isAdmin = false) {
  const me = await requireAdmin();
  const email = norm(rawEmail);
  if (!/^[^@\s]+@archy\.com$/.test(email)) throw new Error('Use an @archy.com address.');
  const { error } = await supabaseAdmin().from('allowed_emails').upsert({ email, is_admin: isAdmin, added_by: me.id });
  if (error) throw new Error(error.message);
}

export async function removeMember(rawEmail: string) {
  const me = await requireAdmin();
  const email = norm(rawEmail);
  if (email === me.email) throw new Error('You cannot remove yourself.');
  const db = supabaseAdmin();
  const user = await userByEmail(email);
  if (user) await db.auth.admin.deleteUser(user.id);
  await db.from('allowed_emails').delete().eq('email', email);
}

// The person's next sign-in asks for a new password; the old one stops working right away
// (sessions already open expire with their token, within the hour).
export async function resetPassword(rawEmail: string) {
  await requireAdmin();
  const email = norm(rawEmail);
  const db = supabaseAdmin();
  const user = await userByEmail(email);
  if (!user) return;
  await db.auth.admin.updateUserById(user.id, { password: randomBytes(24).toString('base64url') });
  await db.from('profiles').update({ password_set: false }).eq('email', email);
}
