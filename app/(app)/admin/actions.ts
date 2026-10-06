'use server';

import { revalidatePath } from 'next/cache';
import { addMember, removeMember, resetPassword } from '@/lib/team';

type Result = { ok: true } | { ok: false; error: string };

async function run(fn: () => Promise<void>): Promise<Result> {
  try {
    await fn();
    revalidatePath('/admin');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function addMemberAction(email: string, isAdmin: boolean) { return run(() => addMember(email, isAdmin)); }
export async function removeMemberAction(email: string) { return run(() => removeMember(email)); }
export async function resetPasswordAction(email: string) { return run(() => resetPassword(email)); }
