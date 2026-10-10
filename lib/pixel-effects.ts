// Archy's pixel effects for any photo, drawn in the browser (no cost, no upload until saved).
//
// - Pixel tone: the photo as an ordered (Bayer 8×8) dither in a few brand blues, the same algorithm as
//   the engine's event-cover photos (scripts/fit.js, window.__pixelTone). Transparent pixels stay
//   transparent, so a cutout keeps its shape.
// - Pixel dissolve: the photo melting into square brand-blue pixels at the bottom, like the "Pixel
//   Dissolve" layers of AE Spotlight. A fixed pattern: the same photo always gives the same result.

export type Tone = 'royal' | 'navy';

// The engine's palettes: royal on royal grounds, navy on navy ones.
const TONE: Record<Tone, { base: number[]; front: number[] }> = {
  royal: { base: [1, 61, 245], front: [1, 105, 250] },
  navy: { base: [0, 0, 78], front: [0, 4, 132] },
};
// Brand blues for the dissolve, the ground colour first.
const BLUES: Record<Tone, string[]> = {
  royal: ['#013DF5', '#0095FF', '#00004E', '#99D1FF'],
  navy: ['#00004E', '#013DF5', '#0095FF', '#99D1FF'],
};

// An image's size; an SVG without its own size is drawn 1600 px wide.
const sizeOf = (img: HTMLImageElement) => (img.naturalWidth && img.naturalHeight ? [img.naturalWidth, img.naturalHeight] : [1600, 1600]);

async function load(src: string) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  return img;
}

// Large photos are drawn at most this wide, so the effect stays quick and the result light.
const MAX = 1600;
function canvasFor(img: HTMLImageElement) {
  const [iw, ih] = sizeOf(img);
  const k = Math.min(1, MAX / Math.max(iw, ih));
  const cv = document.createElement('canvas');
  cv.width = Math.round(iw * k);
  cv.height = Math.round(ih * k);
  const cx = cv.getContext('2d', { willReadFrequently: true })!;
  cx.drawImage(img, 0, 0, cv.width, cv.height);
  return { cv, cx };
}

const bayer8 = (() => {
  let B = [[0, 2], [3, 1]];
  while (B.length < 8) {
    const k = B.length, prev = B;
    B = Array.from({ length: 2 * k }, (_, y) => Array.from({ length: 2 * k }, (_, x) => 4 * prev[y % k][x % k] + [0, 2, 3, 1][Math.floor(y / k) * 2 + Math.floor(x / k)]));
  }
  return B;
})();

// The ordered dither itself, on a canvas in place: auto-contrast on the visible pixels (1% clipped each
// end, as the engine does), then a Bayer 8×8 into `steps + 1` colours from `base` to `front`, in square
// cells of `cell` px. Transparent pixels stay transparent.
function dither(cv: HTMLCanvasElement, base: number[], front: number[], cell: number, steps = 4) {
  const cx = cv.getContext('2d', { willReadFrequently: true })!;
  const W = Math.max(1, Math.round(cv.width / cell)), H = Math.max(1, Math.round(cv.height / cell));
  const small = document.createElement('canvas'); small.width = W; small.height = H;
  const sx = small.getContext('2d', { willReadFrequently: true })!;
  sx.drawImage(cv, 0, 0, W, H);
  const im = sx.getImageData(0, 0, W, H), d = im.data;
  const lum = new Float32Array(W * H);
  const hist = new Array(256).fill(0);
  let seen = 0;
  for (let i = 0; i < W * H; i++) {
    const v = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    lum[i] = v;
    if (d[i * 4 + 3] > 8) { hist[Math.round(v)]++; seen++; }
  }
  const cut = seen * 0.01;
  let lo = 0, hi = 255, acc = 0;
  for (; lo < 255 && (acc += hist[lo]) < cut; lo++);
  acc = 0;
  for (; hi > 0 && (acc += hist[hi]) < cut; hi--);
  const pal = Array.from({ length: steps + 1 }, (_, i) => base.map((b, c) => Math.round(b + ((front[c] - b) * i) / steps)));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (d[i * 4 + 3] <= 8) { d[i * 4 + 3] = 0; continue; }
    const v = Math.min(255, Math.max(0, ((lum[i] - lo) / Math.max(1, hi - lo)) * 255));
    const t = (bayer8[y % 8][x % 8] + 0.5) / 64;
    const c = pal[Math.min(steps, Math.max(0, Math.floor((v / 255) * steps + t)))];
    d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
  }
  sx.putImageData(im, 0, 0);
  cx.clearRect(0, 0, cv.width, cv.height);
  cx.imageSmoothingEnabled = false;
  cx.drawImage(small, 0, 0, cv.width, cv.height);
}

// Pixel tone. `pixel` is the size of one dither pixel in the result (2 = like the event covers).
export async function pixelTone(src: string, tone: Tone, { steps = 4, pixel = 2 } = {}): Promise<Blob> {
  const img = await load(src);
  const { cv } = canvasFor(img);
  dither(cv, TONE[tone].base, TONE[tone].front, pixel, steps);
  return toBlob(cv);
}

// ---- Pixel background: the person as photographed, the place behind them in pixel tone ----

// Brand blues for the background, dark to light (no Sky: it is never a ground). Navy and Royal are the engine's own; Navy → Royal has
// more contrast, for a pixel pattern that reads from afar.
export const PALETTES = [
  { key: 'navy', label: 'Navy', base: [0, 0, 78], front: [0, 4, 132] },
  { key: 'royal', label: 'Royal', base: [1, 61, 245], front: [1, 105, 250] },
  { key: 'ice', label: 'Ice', base: [153, 209, 255], front: [230, 244, 255] },
  { key: 'navy-royal', label: 'Navy → Royal', base: [0, 0, 78], front: [1, 61, 245] },
] as const;
export type PaletteKey = (typeof PALETTES)[number]['key'];
// Pixel size, relative to the photo's width (Fine is about 2 px on a 1080 px photo, like the covers).
export const PIXEL_SIZES = [{ key: 'fine', label: 'Fine', per: 540 }, { key: 'medium', label: 'Medium', per: 270 }, { key: 'large', label: 'Large', per: 135 }] as const;
export type PixelSize = (typeof PIXEL_SIZES)[number]['key'];
export const swatch = (k: PaletteKey) => { const p = PALETTES.find((x) => x.key === k)!; return `linear-gradient(135deg, rgb(${p.base.join(',')}), rgb(${p.front.join(',')}))`; };

export const loadImage = load;

// Draws the effect at most `max` px wide (a quick preview) or at full size, from the photo and its mask
// (the person on transparency, the photo's size).
export function drawPixelBackground(photo: HTMLImageElement, mask: HTMLImageElement, palette: PaletteKey, size: PixelSize, max = MAX): HTMLCanvasElement {
  const [pw, ph] = sizeOf(photo);
  const k = Math.min(1, max / Math.max(pw, ph));
  const cv = document.createElement('canvas');
  cv.width = Math.round(pw * k);
  cv.height = Math.round(ph * k);
  const cx = cv.getContext('2d', { willReadFrequently: true })!;
  cx.drawImage(photo, 0, 0, cv.width, cv.height);
  const p = PALETTES.find((x) => x.key === palette)!;
  const per = PIXEL_SIZES.find((x) => x.key === size)!.per;
  dither(cv, [...p.base], [...p.front], Math.max(1, cv.width / per));
  cx.imageSmoothingEnabled = true;
  cx.drawImage(mask, 0, 0, cv.width, cv.height);
  return cv;
}

export async function pixelBackground(photoSrc: string, maskSrc: string, palette: PaletteKey, size: PixelSize): Promise<Blob> {
  const [photo, mask] = await Promise.all([load(photoSrc), load(maskSrc)]);
  return toBlob(drawPixelBackground(photo, mask, palette, size), 'image/webp', 0.9);
}

// Pixel dissolve. The bottom `depth` of the photo turns into square pixels (about 34 across), denser
// toward the bottom edge, where the ground colour closes it.
export async function pixelDissolve(src: string, tone: Tone, { depth = 0.36, across = 34 } = {}): Promise<Blob> {
  const img = await load(src);
  const { cv, cx } = canvasFor(img);
  const size = Math.max(4, Math.round(cv.width / across));
  const rows = Math.ceil((cv.height * depth) / size), cols = Math.ceil(cv.width / size);
  const colours = BLUES[tone];
  // A fixed pseudo-random value per cell (same photo, same pattern).
  const rand = (x: number, y: number, k: number) => { const s = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };
  for (let r = 0; r < rows; r++) {
    // r = 0 is the bottom row: almost all ground colour; the top of the band only a few pixels.
    const f = 1 - r / rows;
    const density = Math.pow(f, 1.6);
    for (let c = 0; c < cols; c++) {
      if (rand(c, r, 1) > density) continue;
      const pick = rand(c, r, 2);
      // Lower rows lean to the ground colour, higher rows mix the other blues.
      const i = pick < 0.45 + 0.5 * f ? 0 : 1 + Math.floor(rand(c, r, 3) * (colours.length - 1));
      cx.fillStyle = colours[i];
      cx.fillRect(c * size, cv.height - (r + 1) * size, size, size);
    }
  }
  // A photo: WebP keeps it light (and any transparency).
  return toBlob(cv, 'image/webp', 0.9);
}

// Pixel tone is a few flat colours: PNG is small and exact.
const encode = (cv: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((ok, fail) => cv.toBlob((b) => (b ? ok(b) : fail(new Error('Could not make the image.'))), type, quality));
// Always under the upload limit: a browser without WebP (Safari) makes a PNG, which can be much heavier,
// so the image steps down in size until it fits.
const LIMIT = 3_800_000;
async function toBlob(cv: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  let blob = await encode(cv, type, quality);
  for (let i = 0; blob.size > LIMIT && i < 5; i++) {
    const smaller = document.createElement('canvas');
    smaller.width = Math.round(cv.width * 0.8); smaller.height = Math.round(cv.height * 0.8);
    const sx = smaller.getContext('2d')!;
    sx.imageSmoothingEnabled = type === 'image/png' ? false : true;
    sx.drawImage(cv, 0, 0, smaller.width, smaller.height);
    cv = smaller;
    blob = await encode(cv, type, quality);
  }
  return blob;
}
