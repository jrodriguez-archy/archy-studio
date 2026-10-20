'use server';

import { revalidatePath } from 'next/cache';
import { LESSON_STATUSES, updateLesson, type LessonStatus } from '@/lib/lessons';
import { currentUser } from '@/lib/team';

// Admins edit a lesson's words and approve it (it reaches every exploration from then on) or retire it.
export async function saveLessonAction(form: FormData) {
  const me = await currentUser();
  if (!me?.is_admin) return;
  const status = String(form.get('status') ?? '') as LessonStatus;
  await updateLesson(String(form.get('id')), {
    title: String(form.get('title') ?? ''),
    body: String(form.get('body') ?? ''),
    applies_when: String(form.get('applies_when') ?? ''),
    ...(LESSON_STATUSES.includes(status) ? { status } : {}),
  }, me.id);
  revalidatePath('/admin/lessons');
}
