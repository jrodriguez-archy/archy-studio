'use server';

import { accessStatus, createPassword, type AccessStatus } from '@/lib/team';

export async function checkEmail(email: string): Promise<AccessStatus> {
  return accessStatus(email);
}

export async function setFirstPassword(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await createPassword(email, password);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
