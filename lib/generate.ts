import 'server-only';
import { generateText } from 'ai';
import { MAX_PIXELS } from './assets';

// Image generation through the Vercel AI Gateway (Nano Banana 2): Assets → Generate, and the
// placeholder photos a design uses until the real one arrives.
const MODEL = 'google/gemini-3.1-flash-image-preview';
export const RATIOS: Record<string, [number, number]> = { '1:1': [1, 1], '4:5': [4, 5], '9:16': [9, 16], '16:9': [16, 9] };
// A guide for the model, not a wall: Studio is for scenes, places, objects and textures; photos of the
// team are uploaded, never made up.
const GUIDE = 'You make images for Archy, a dental practice software company, used in marketing designs. Photographic, natural light, clean and modern. Do not add text, logos or watermarks unless asked.';

// A PNG at exactly the ratio asked for (centre crop). `source`: an image to edit instead.
export async function generateImage(prompt: string, ratio: string, source?: { body: Buffer; type: string } | null): Promise<Buffer> {
  const instruction = `${GUIDE}\n\n${source ? 'Edit this image: ' : 'Create an image: '}${prompt}\nAspect ratio ${ratio}.`;
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
