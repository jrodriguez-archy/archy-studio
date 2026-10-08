import { moveAssets } from '@/lib/assets';
import { currentUser } from '@/lib/team';

// File one or several images into a team folder (folderId null: out of any folder).
export async function POST(req: Request) {
  if (!(await currentUser())) return Response.json({ error: 'Sign in again.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
  const folderId = typeof body.folderId === 'string' && body.folderId ? body.folderId : null;
  try { await moveAssets(ids, folderId); return Response.json({ ok: true }); }
  catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
}
