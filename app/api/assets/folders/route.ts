import { createFolder, listFolders } from '@/lib/assets';
import { currentUser } from '@/lib/team';

// The team's folders for Assets (with how many images each holds), and a new one.
export async function GET() {
  if (!(await currentUser())) return Response.json({ error: 'Sign in again.' }, { status: 401 });
  return Response.json({ folders: await listFolders() });
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return Response.json({ error: 'Sign in again.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try { return Response.json({ folder: await createFolder(me, String(body.name ?? '')) }); }
  catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
}
