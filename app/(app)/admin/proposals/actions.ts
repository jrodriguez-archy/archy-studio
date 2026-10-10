'use server';

import { revalidatePath } from 'next/cache';
import { setProposalStatus, STATUSES, type ProposalStatus } from '@/lib/proposals';
import { currentUser } from '@/lib/team';

// Admins move a proposal along: making it, done, or dismissed (and back to proposed).
export async function setProposalStatusAction(form: FormData) {
  const me = await currentUser();
  if (!me?.is_admin) return;
  const status = String(form.get('status')) as ProposalStatus;
  if (!STATUSES.includes(status)) return;
  await setProposalStatus(String(form.get('id')), status);
  revalidatePath('/admin/proposals');
  revalidatePath('/', 'layout');
}
