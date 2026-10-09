import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { findAsset } from './asset-ids';
import { MAX_PIXELS, createAsset, readAsset } from './assets';
import type { Brand } from './brands';
import { ORIGIN, resolveImage } from './fill';
import { ROOT } from './templates';

export type Expand = { top: number; right: number; bottom: number; left: number };

// What is sent to the model at most (photo and what is painted around it): enough for a full-frame
// photo on a 1080 px design at 2x, and quick to make.
const MAX_OUT = 4_000_000;

// "Generate content around": the photo kept as it is and the scene painted on past its edges, by the
// pixels asked for on each side. FLUX.2 [pro] Outpaint on fal.ai (no prompt: it reads the photo).
export async function outpaint(imageUrl: string, expand: Expand): Promise<Buffer> {
  if (!process.env.FAL_KEY) throw new Error('Generate content around is not set up yet (FAL_KEY).');
  const res = await fetch('https://fal.run/fal-ai/flux-2-pro/outpaint', {
    method: 'POST',
    headers: { Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrl, expand_top: expand.top, expand_right: expand.right, expand_bottom: expand.bottom, expand_left: expand.left,
      mode: 'high', output_format: 'png',
    }),
  });
  const out = await res.json().catch(() => null);
  const url = out?.images?.[0]?.url;
  if (!res.ok || !url) throw new Error(out?.detail?.[0]?.msg ?? (typeof out?.detail === 'string' ? out.detail : 'The photo could not be extended. Try again.'));
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}

// A slot photo extended by `expand` (its own pixels, upright) and kept as a new asset ("generated").
// Canvas's button and Claude's render both use it; the daily limit is counted by the caller.
export async function extendPhoto(input: { template: string; image: string; expand: Expand; ownerId: string; brand?: Brand }): Promise<{ value: string; width: number; height: number }> {
  const { expand } = input;
  const sharp = (await import('sharp')).default;
  // Upright, as the browser shows it (the frame was measured on that).
  const upright = await sharp(await readSource(input.template, input.image), { limitInputPixels: MAX_PIXELS }).rotate().toBuffer();
  const { width: w = 0, height: h = 0 } = await sharp(upright).metadata();
  if (!w || !h) throw new Error('This photo could not be read.');
  // Larger than the model needs: the photo and the sides shrink together (same proportions).
  const r = Math.min(1, Math.sqrt(MAX_OUT / ((w + expand.left + expand.right) * (h + expand.top + expand.bottom))));
  const src = r < 1 ? await sharp(upright).resize(Math.round(w * r), Math.round(h * r)).jpeg({ quality: 92 }).toBuffer() : await sharp(upright).jpeg({ quality: 92 }).toBuffer();
  const sides = r < 1 ? { top: Math.round(expand.top * r), right: Math.round(expand.right * r), bottom: Math.round(expand.bottom * r), left: Math.round(expand.left * r) } : expand;
  const made = await outpaint(`data:image/jpeg;base64,${src.toString('base64')}`, sides);
  // The model rounds its canvas to a multiple of 16 px: brought back to the size asked for, so the photo
  // sits exactly where it is expected.
  const { width: sw = 0, height: sh = 0 } = await sharp(src).metadata();
  const jpeg = await sharp(made, { limitInputPixels: MAX_PIXELS })
    .resize(sw + sides.left + sides.right, sh + sides.top + sides.bottom, { fit: 'fill' }).jpeg({ quality: 92 }).toBuffer();
  const out = await sharp(jpeg).metadata();
  const parent = input.image.startsWith('asset:') ? await findAsset(input.image.slice(6).trim()) : null;
  const asset = await createAsset({ ownerId: input.ownerId, body: jpeg, type: 'image/jpeg', name: 'Photo · extended', kind: 'generated', parentId: parent?.id ?? null, prompt: 'Generate content around', brand: input.brand });
  return { value: asset.value, width: out.width ?? 0, height: out.height ?? 0 };
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
