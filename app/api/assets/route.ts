import { listAssets } from '@/lib/assets';
import { currentUser } from '@/lib/team';

// The team's assets, or one person's (?whose=mine), or one folder's (?folder=<id>), or by name (?search=).
export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return Response.json({ error: 'Sign in again.' }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const mine = q.get('whose') === 'mine';
  // ?folder=<id>: everything in that folder (not only the newest).
  const folder = q.get('folder') ?? undefined;
  // ?search=<text>: by name, in every image of the team.
  const search = q.get('search') ?? undefined;
  return Response.json({ assets: await listAssets({ ...(mine ? { ownerId: me.id } : {}), ...(folder ? { folderId: folder, limit: 1000 } : {}), ...(search ? { search, limit: 200 } : {}) }) });
}
