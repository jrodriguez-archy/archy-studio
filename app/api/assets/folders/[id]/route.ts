import { deleteFolder, renameFolder } from '@/lib/assets';
import { currentUser } from '@/lib/team';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const me = await currentUser();
  if (!me) return Response.json({ error: 'Sign in again.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try { return Response.json({ ok: true, name: await renameFolder(me, (await params).id, String(body.name ?? '')) }); }
  catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
}

// The folder goes; its images stay in Assets.
export async function DELETE(_req: Request, { params }: Ctx) {
  const me = await currentUser();
  if (!me) return Response.json({ error: 'Sign in again.' }, { status: 401 });
  try { await deleteFolder(me, (await params).id); return Response.json({ ok: true }); }
  catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
}
