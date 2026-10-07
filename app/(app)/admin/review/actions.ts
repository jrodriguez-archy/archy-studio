'use server';

import { revalidatePath } from 'next/cache';
import { addComment, deleteComment, setStatus, type ReviewStatus } from '@/lib/review';
import { currentUser } from '@/lib/team';

// Template review actions: admins only.
async function admin() {
  const me = await currentUser();
  if (!me?.is_admin) throw new Error('Only admins can review templates.');
  return me;
}

export async function setStatusAction(itemId: string, status: ReviewStatus) {
  await admin();
  await setStatus(itemId, status);
  revalidatePath('/admin/review');
}

export async function addCommentAction(itemId: string, body: string, point: { x: number; y: number } | null) {
  const me = await admin();
  const text = body.trim();
  if (!text) throw new Error('Write a comment first.');
  const id = await addComment(me.id, itemId, text.slice(0, 2000), point);
  revalidatePath('/admin/review');
  return id;
}

export async function deleteCommentAction(commentId: string) {
  await admin();
  await deleteComment(commentId);
  revalidatePath('/admin/review');
}
