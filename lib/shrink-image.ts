// The server takes 4 MB at most (Vercel caps a request at 4.5 MB): a larger image (straight from a phone
// or a camera, a big PNG export) is redrawn smaller in the browser, upright, before it goes. 2800 px on
// its long side is more than a 1080 px design needs at 2x. Used by every upload (Assets, Canvas, photo links).
export const MAX_BYTES = 3_800_000;
const SIDES = [2800, 2400, 2000, 1600];

export async function shrinkImage(file: File): Promise<File> {
  if (file.size <= MAX_BYTES || file.type === 'image/svg+xml') return file;
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bmp) throw new Error(`${file.name} could not be read. Export it as PNG or JPG and try again.`);
  const base = file.name.replace(/\.\w+$/, '') || 'Image';
  try {
    let clear: boolean | null = null; // has transparent pixels (a cutout, a logo): known after the first draw
    for (const side of SIDES) {
      const k = Math.min(1, side / Math.max(bmp.width, bmp.height));
      const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
      const ctx: CanvasRenderingContext2D = canvas.getContext('2d', { willReadFrequently: clear === null })!;
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      clear ??= file.type !== 'image/jpeg' && transparent(ctx, canvas.width, canvas.height);
      // Transparency is kept (PNG, else WebP); anything else goes as JPEG.
      const tries: [string, string, number][] = clear
        ? [['image/png', 'png', 1], ['image/webp', 'webp', 0.9]]
        : [['image/jpeg', 'jpg', 0.9], ['image/jpeg', 'jpg', 0.8], ['image/jpeg', 'jpg', 0.7]];
      for (const [type, ext, q] of tries) {
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
        // A browser that cannot write WebP gives a PNG back: only the type asked for counts.
        if (blob && blob.type === type && blob.size <= MAX_BYTES) return new File([blob], `${base}.${ext}`, { type });
      }
    }
  } finally {
    bmp.close();
  }
  throw new Error(`${file.name} is too large. Export it smaller and try again.`);
}

// Any pixel not fully opaque (sampled on a grid, enough for a cutout's background).
function transparent(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const { data } = ctx.getImageData(0, 0, w, h);
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 250_000)));
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (data[(y * w + x) * 4 + 3] < 255) return true;
  return false;
}
