import { addPhoto } from '@/lib/photo-requests';
import { currentUser } from '@/lib/team';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Vercel caps a request body at 4.5 MB; the page shrinks larger photos before sending them.
const MAX = 4_000_000;

// One photo dropped on a photo link (/u/<id>).
export async function POST(req: Request, { params }: { params: Promise<{ id: string; key: string }> }) {
  const me = await currentUser();
  if (!me) return Response.json({ error: 'Sign in again.' }, { status: 401 });
  const { id, key } = await params;
  const file = (await req.formData().catch(() => null))?.get('file');
  if (!(file instanceof File) || !file.type.startsWith('image/')) return Response.json({ error: 'Choose a photo.' }, { status: 400 });
  if (file.size > MAX) return Response.json({ error: 'The photo is larger than 4 MB.' }, { status: 413 });
  try {
    const { asset, cutout } = await addPhoto(id, key, me, { body: Buffer.from(await file.arrayBuffer()), type: file.type });
    return Response.json({ thumb: asset.thumb, cutout });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
