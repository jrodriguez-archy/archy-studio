import { listAssets } from '@/lib/assets';
import { currentUser } from '@/lib/team';

// The team's assets, or one person's (?whose=mine).
export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return Response.json({ error: 'Sign in again.' }, { status: 401 });
  const mine = new URL(req.url).searchParams.get('whose') === 'mine';
  return Response.json({ assets: await listAssets(mine ? { ownerId: me.id } : {}) });
}
