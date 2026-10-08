'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/team';

// The name shown across Studio (sidebar, gallery, assets). Empty: back to the one from the email.
export async function updateNameAction(name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await currentUser();
  if (!me) return { ok: false, error: 'Sign in again.' };
  const n = Array.from(name.trim().replace(/\s+/g, ' ')).slice(0, 80).join('');
  const { error } = await supabaseAdmin().from('profiles').update({ full_name: n || null }).eq('id', me.id);
  if (error) return { ok: false, error: 'Could not save the name.' };
  revalidatePath('/', 'layout');
  return { ok: true };
}
