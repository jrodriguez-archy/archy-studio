import { DAILY, MAX_PIXELS, getAsset, sourceFor, useAi } from '@/lib/assets';
import { removeBackground } from '@/lib/cutout';
import { currentUser } from '@/lib/team';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Masks being made right now on this server: a second request for the same photo waits for the first.
const making = new Map<string, Promise<Buffer>>();

// The person of a photo on transparency, the photo's own size (not trimmed), so an effect can lay it
// back over the treated background pixel for pixel. Made once per photo and kept (masks/<id>.png).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return new Response('Sign in again.', { status: 401 });
  const asset = await getAsset((await params).id);
  if (!asset) return Response.json({ error: 'Image not found.' }, { status: 404 });
  const store = supabaseAdmin().storage.from('uploads');
  const key = `masks/${asset.id}.png`;
  const cached = await store.download(key);
  let png: Buffer;
  if (cached.data) png = Buffer.from(await cached.data.arrayBuffer());
  else {
    try {
      let job = making.get(asset.id);
      if (!job) {
        if (!(await useAi(me.id, 'cutout'))) return Response.json({ error: `You removed ${DAILY.cutout} backgrounds today. Try again tomorrow.` }, { status: 429 });
        job = (async () => {
          let out = await removeBackground((await sourceFor(asset)).url);
          // Exactly the photo's size (BiRefNet keeps it; this makes sure).
          if (asset.width && asset.height) {
            const sharp = (await import('sharp')).default;
            out = await sharp(out, { limitInputPixels: MAX_PIXELS }).resize(asset.width, asset.height, { fit: 'fill' }).png().toBuffer();
          }
          await store.upload(key, out, { contentType: 'image/png', upsert: true });
          return out;
        })().finally(() => making.delete(asset.id));
        making.set(asset.id, job);
      }
      png = await job;
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 400 });
    }
  }
  return new Response(new Uint8Array(png), { headers: {
    'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox",
  } });
}
