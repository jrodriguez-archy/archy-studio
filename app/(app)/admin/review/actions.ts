'use server';

import { addComments, deleteComment, moveComment, setStatus, type ReviewStatus } from '@/lib/review';
import { currentUser } from '@/lib/team';

// Template review actions: admins only. The board updates itself in place, so nothing reloads the
// round (signing every image again made each comment slow).
async function admin() {
  const me = await currentUser();
  if (!me?.is_admin) throw new Error('Only admins can review templates.');
  return me;
}

export async function setStatusAction(itemId: string, status: ReviewStatus) {
  await admin();
  await setStatus(itemId, status);
}

// One comment on this design, and the same on the other formats when asked (same spot).
export async function addCommentAction(itemId: string, body: string, point: { x: number; y: number } | null, alsoIds: string[] = []) {
  const me = await admin();
  const text = body.trim().slice(0, 2000);
  if (!text) throw new Error('Write a comment first.');
  return addComments(me.id, [itemId, ...alsoIds].map((id) => ({ itemId: id, body: text, x: point?.x ?? null, y: point?.y ?? null })));
}

// Comments copied from another design.
export async function pasteCommentsAction(itemIds: string[], comments: { body: string; x: number | null; y: number | null }[]) {
  const me = await admin();
  return addComments(me.id, itemIds.flatMap((itemId) => comments.slice(0, 50).map((c) => ({ itemId, body: c.body.slice(0, 2000), x: c.x, y: c.y }))));
}

export async function moveCommentAction(commentId: string, x: number, y: number) {
  await admin();
  await moveComment(commentId, Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)));
}

export async function deleteCommentAction(commentId: string) {
  await admin();
  await deleteComment(commentId);
}
