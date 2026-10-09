'use server';

import { markOnboarding } from '@/lib/onboarding';
import { currentUser } from '@/lib/team';

// The "Get started" card closed: it does not come back.
export async function dismissOnboardingAction() {
  const me = await currentUser();
  if (me) await markOnboarding(me, 'dismissed_at');
}
