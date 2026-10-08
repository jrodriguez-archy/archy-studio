import { DAILY, MAX_PIXELS, createAsset, getAsset, sourceFor, useAi } from '@/lib/assets';
import { removeBackground } from '@/lib/cutout';
import { currentUser } from '@/lib/team';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Remove background: the person alone on a transparent PNG, as a new asset. The empty border is trimmed
// so the cutout fills its frame.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return Response.json({ error: 'Sign in again.' }, { status: 401 });
  if (!process.env.FAL_KEY) return Response.json({ error: 'Remove background is not set up yet (FAL_KEY).' }, { status: 503 });
  const asset = await getAsset((await params).id);
  if (!asset) return Response.json({ error: 'Image not found.' }, { status: 404 });
  if (!(await useAi(me.id, 'cutout'))) return Response.json({ error: `You removed ${DAILY.cutout} backgrounds today. Try again tomorrow.` }, { status: 429 });
  try {
    const png = await removeBackground((await sourceFor(asset)).url);
    const sharp = (await import('sharp')).default;
    const trimmed = await sharp(png, { limitInputPixels: MAX_PIXELS }).trim({ threshold: 1 }).png().toBuffer().catch(() => png);
    const made = await createAsset({ ownerId: me.id, body: trimmed, type: 'image/png', name: `${asset.name} · cutout`, kind: 'cutout', parentId: asset.id, folderId: new URL(req.url).searchParams.get('folder') ?? asset.folderId });
    return Response.json({ asset: made });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
