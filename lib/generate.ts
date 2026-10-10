import 'server-only';
import { generateText } from 'ai';
import { MAX_PIXELS } from './assets';
import type { Brand } from './brands';

// Image generation through the Vercel AI Gateway (Nano Banana 2): Assets → Generate, and the
// placeholder photos a design uses until the real one arrives.
const MODEL = 'google/gemini-3.1-flash-image-preview';
export const RATIOS: Record<string, [number, number]> = { '1:1': [1, 1], '4:5': [4, 5], '9:16': [9, 16], '16:9': [16, 9] };
// A guide for the model, not a wall: Studio is for scenes, places, objects and textures; photos of the
// team are uploaded, never made up.
const WHO: Record<Brand, string> = {
  archy: 'Archy, a dental practice software company',
  doc: 'DOC, the Dental Ownership Collective, ownership education for dentists who want their own practice',
};
const guide = (brand: Brand) => `You make images for ${WHO[brand]}, used in marketing designs. Photographic, natural light, clean and modern. Do not add text, logos or watermarks unless asked.`;

// A PNG at exactly the ratio asked for (centre crop). `source`: an image to edit instead.
export async function generateImage(prompt: string, ratio: string, source?: { body: Buffer; type: string } | null, brand: Brand = 'archy'): Promise<Buffer> {
  const instruction = `${guide(brand)}\n\n${source ? 'Edit this image: ' : 'Create an image: '}${prompt}\nAspect ratio ${ratio}.`;
  const result = await generateText({
    model: MODEL,
    messages: [{ role: 'user', content: [{ type: 'text', text: instruction }, ...(source ? [{ type: 'image' as const, image: source.body, mediaType: source.type }] : [])] }],
    providerOptions: { google: { imageConfig: { aspectRatio: ratio } } },
  });
  const file = result.files.find((f) => f.mediaType?.startsWith('image/'));
  if (!file) throw new Error(result.text?.trim() || 'No image came back. Try describing it differently.');
  const sharp = (await import('sharp')).default;
  const img = sharp(Buffer.from(file.uint8Array), { limitInputPixels: MAX_PIXELS });
  const { width = 1024, height = 1024 } = await img.metadata();
  const [rw, rh] = RATIOS[ratio] ?? [1, 1];
  const w = Math.min(width, Math.round((height * rw) / rh)), h = Math.min(height, Math.round((width * rh) / rw));
  return img.extract({ left: Math.round((width - w) / 2), top: Math.round((height - h) / 2), width: w, height: h }).png().toBuffer();
}

// ---- Images for explorations (the MCP's generate_image): made for the frame they fill ----

// The shapes the model draws; the result is then cut to the frame's exact shape (centre crop).
const MODEL_RATIOS: [string, number][] = [['1:1', 1], ['2:3', 2 / 3], ['3:2', 3 / 2], ['3:4', 3 / 4], ['4:3', 4 / 3], ['4:5', 4 / 5], ['5:4', 5 / 4], ['9:16', 9 / 16], ['16:9', 16 / 9], ['21:9', 21 / 9]];
const nearestRatio = (r: number) => MODEL_RATIOS.reduce((a, b) => (Math.abs(Math.log(b[1] / r)) < Math.abs(Math.log(a[1] / r)) ? b : a));

export type CopySpace = 'top' | 'bottom' | 'left' | 'right' | 'none';
const SPACE: Record<CopySpace, string> = {
  top: 'Frame it so the upper third of the same scene is calm (a plain wall, sky or soft out-of-focus background, with no text or signage in it), with the subjects large in the lower two thirds, starting right under it: copy will go on top.',
  bottom: 'Frame it so the lower third of the same scene is calm (a plain surface or soft out-of-focus foreground, with no text in it), with the subjects large in the upper two thirds: copy will go at the bottom.',
  left: 'Frame it so the left part of the same scene is calm (a plain wall or soft out-of-focus background, with no text or signage in it) with the subjects large on the right: copy will go on the left.',
  right: 'Frame it so the right part of the same scene is calm (a plain wall or soft out-of-focus background, with no text or signage in it) with the subjects large on the left: copy will go on the right.',
  none: '',
};

// Archy's photography for marketing pieces, as the brand describes it, and what a made-up image must
// never show (a person, a real venue, words, a logo).
const EXPLORE_GUIDE = `Art direction: editorial, magazine-quality photography, realistic. A clear subject, large and close to the camera, and a real moment: something is happening (a hygienist showing a patient something on a tablet, hands checking in at a front desk, a team laughing over a schedule). Shallow depth of field, a considered composition, directional natural light. Never an empty room, a lone object with nothing happening, or a stock-photo pose. If the request only names an object or a place, build a human moment around it, unless it says there are no people.
Archy's look: a modern dental practice, its team and patients, a city or an everyday object; clean and modern, true colours with no filter or heavy grade.
One continuous photograph, edge to edge: no split, collage, panel, border, frame, blur band or empty area added beside it.
People are welcome as generic, natural people. Never a specific real person, a logo or a watermark (devices and products show no brand marks), or a specific real venue presented as itself.`;

/** A PNG at exactly width × height for a frame of an exploration. */
export async function generateForFrame(input: { prompt: string; width: number; height: number; copySpace?: CopySpace; brand?: Brand }): Promise<Buffer> {
  const { width, height } = input;
  const [ratio] = nearestRatio(width / height);
  const instruction = `${guide(input.brand ?? 'archy')}\n${EXPLORE_GUIDE}\n\nCreate an image: ${input.prompt}\n${SPACE[input.copySpace ?? 'none']}\nAspect ratio ${ratio}.`;
  const result = await generateText({
    model: MODEL,
    messages: [{ role: 'user', content: [{ type: 'text', text: instruction }] }],
    providerOptions: { google: { imageConfig: { aspectRatio: ratio } } },
  });
  const file = result.files.find((f) => f.mediaType?.startsWith('image/'));
  if (!file) throw new Error(result.text?.trim() || 'No image came back. Try describing it differently.');
  const sharp = (await import('sharp')).default;
  const img = sharp(Buffer.from(file.uint8Array), { limitInputPixels: MAX_PIXELS });
  const { width: iw = 1024, height: ih = 1024 } = await img.metadata();
  // Cut to the frame's shape, then no larger than the frame at 2x (the design's own resolution).
  const target = width / height;
  const w = Math.min(iw, Math.round(ih * target)), h = Math.min(ih, Math.round(iw / target));
  return img.extract({ left: Math.round((iw - w) / 2), top: Math.round((ih - h) / 2), width: w, height: h })
    .resize({ width: Math.min(w, width * 2), withoutEnlargement: true }).png().toBuffer();
}

// ---- Pixel Tone: Archy's dithered grain on a photo (as tools/pixel/pixel.py and scripts/fit.js) ----

export const TONES = { royal: [[1, 61, 245], [1, 105, 250]], navy: [[0, 0, 78], [0, 4, 132]], ice: [[204, 234, 255], [230, 244, 255]] } as const;
export type Tone = keyof typeof TONES;

/** The photo in two brand tones: autocontrast (1%), 4 steps, Bayer 8×8, one cell per pixel at 2x of the frame. */
export async function pixelTone(body: Buffer, frame: { width: number; height: number }, tone: Tone): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const W = Math.round(frame.width * 2), H = Math.round(frame.height * 2);
  const { data } = await sharp(body, { limitInputPixels: MAX_PIXELS }).rotate().resize(W, H, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = W * H, lum = new Float32Array(n), hist = new Array(256).fill(0);
  for (let i = 0; i < n; i++) { const v = 0.299 * data[i * 3] + 0.587 * data[i * 3 + 1] + 0.114 * data[i * 3 + 2]; lum[i] = v; hist[Math.round(v)]++; }
  const cut = n * 0.01;
  let lo = 0, hi = 255, acc = 0;
  for (; lo < 255 && (acc += hist[lo]) < cut; lo++);
  acc = 0;
  for (; hi > 0 && (acc += hist[hi]) < cut; hi--);
  let B = [[0, 2], [3, 1]];
  while (B.length < 8) { const k = B.length, P = B; B = Array.from({ length: 2 * k }, (_, y) => Array.from({ length: 2 * k }, (_, x) => 4 * P[y % k][x % k] + [0, 2, 3, 1][Math.floor(y / k) * 2 + Math.floor(x / k)])); }
  const steps = 4, [base, front] = TONES[tone];
  const pal = Array.from({ length: steps + 1 }, (_, i) => base.map((b, c) => Math.round(b + ((front[c] - b) * i) / steps)));
  const out = Buffer.alloc(n * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const v = Math.min(255, Math.max(0, ((lum[i] - lo) / Math.max(1, hi - lo)) * 255));
    const t = (B[y % 8][x % 8] + 0.5) / 64;
    const c = pal[Math.min(steps, Math.max(0, Math.floor((v / 255) * steps + t)))];
    out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
  }
  return sharp(out, { raw: { width: W, height: H, channels: 3 } }).png({ palette: true, colours: steps + 1 }).toBuffer();
}
