import fs from 'node:fs/promises';
import path from 'node:path';
import { findAsset } from '@/lib/asset-ids';
import { DAILY, MAX_PIXELS, createAsset, readAsset, useAi } from '@/lib/assets';
import { ORIGIN, resolveImage } from '@/lib/fill';
import { outpaint, type Expand } from '@/lib/outpaint';
import { currentUser } from '@/lib/team';
import { ROOT } from '@/lib/templates';

export const runtime = 'nodejs';
export const maxDuration = 60;

// What is sent to the model at most (photo and what is painted around it): enough for a full-frame
// photo on a 1080 px design at 2x, and quick to make.
const MAX_OUT = 4_000_000;

// "Generate content around" (Canvas): a photo smaller than its frame gets the scene painted on past its
// edges, by the pixels the frame still needs on each side. The result is a new asset ("generated") and
// its value goes in the slot.
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return Response.json({ error: 'Sign in again.' }, { status: 401 });
  if (!process.env.FAL_KEY) return Response.json({ error: 'Generate content around is not set up yet (FAL_KEY).' }, { status: 503 });
  const body = await req.json().catch(() => null) as { template?: string; image?: string; expand?: Partial<Expand> } | null;
  const side = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);
  const expand: Expand = { top: side(body?.expand?.top), right: side(body?.expand?.right), bottom: side(body?.expand?.bottom), left: side(body?.expand?.left) };
  if (!body?.template || !body.image) return Response.json({ error: 'Pick the photo to extend.' }, { status: 400 });
  if (!expand.top && !expand.right && !expand.bottom && !expand.left) return Response.json({ error: 'The photo already fills its frame.' }, { status: 400 });
  if (!(await useAi(me.id, 'outpaint'))) return Response.json({ error: `You extended ${DAILY.outpaint} photos today. Try again tomorrow.` }, { status: 429 });
  try {
    const sharp = (await import('sharp')).default;
    // Upright, as the browser shows it (the frame was measured on that).
    const upright = await sharp(await readSource(body.template, body.image), { limitInputPixels: MAX_PIXELS }).rotate().toBuffer();
    const { width: w = 0, height: h = 0 } = await sharp(upright).metadata();
    if (!w || !h) throw new Error('This photo could not be read.');
    // Larger than the model needs: the photo and the sides shrink together (same proportions).
    const r = Math.min(1, Math.sqrt(MAX_OUT / ((w + expand.left + expand.right) * (h + expand.top + expand.bottom))));
    const src = r < 1 ? await sharp(upright).resize(Math.round(w * r), Math.round(h * r)).jpeg({ quality: 92 }).toBuffer() : await sharp(upright).jpeg({ quality: 92 }).toBuffer();
    const sides = r < 1 ? { top: Math.round(expand.top * r), right: Math.round(expand.right * r), bottom: Math.round(expand.bottom * r), left: Math.round(expand.left * r) } : expand;
    const made = await outpaint(`data:image/jpeg;base64,${src.toString('base64')}`, sides);
    // The model rounds its canvas to a multiple of 16 px: brought back to the size asked for, so the photo
    // sits exactly where Canvas expects it.
    const { width: sw = 0, height: sh = 0 } = await sharp(src).metadata();
    const jpeg = await sharp(made, { limitInputPixels: MAX_PIXELS })
      .resize(sw + sides.left + sides.right, sh + sides.top + sides.bottom, { fit: 'fill' }).jpeg({ quality: 92 }).toBuffer();
    const out = await sharp(jpeg).metadata();
    const parent = body.image.startsWith('asset:') ? await findAsset(body.image.slice(6).trim()) : null;
    const asset = await createAsset({ ownerId: me.id, body: jpeg, type: 'image/jpeg', name: 'Photo · extended', kind: 'generated', parentId: parent?.id ?? null, prompt: 'Generate content around' });
    return Response.json({ value: asset.value, width: out.width, height: out.height });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

// The photo's file: an upload, a team asset, a template's sample image or stand-in, or a link.
async function readSource(template: string, value: string): Promise<Buffer> {
  if (value.startsWith('upload:')) return (await readAsset(value.slice(7))).body;
  const url = await resolveImage(template, value, ORIGIN);
  if (url.startsWith(`${ORIGIN}/`)) {
    const file = path.resolve(ROOT, decodeURIComponent(url.slice(ORIGIN.length + 1)));
    if (!file.startsWith(ROOT + path.sep)) throw new Error('Unknown photo.');
    return fs.readFile(file);
  }
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 ArchyStudio' } });
  if (!res.ok) throw new Error(`Could not open the photo (${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}
