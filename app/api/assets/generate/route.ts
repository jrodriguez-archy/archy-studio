import { generateText } from 'ai';
import { DAILY, MAX_PIXELS, createAsset, getAsset, readAsset, sourceFor, useAi } from '@/lib/assets';
import { currentUser } from '@/lib/team';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Generate an image (or edit one with instructions) through the Vercel AI Gateway: Nano Banana 2.
// The result joins the team's assets with its prompt.
const MODEL = 'google/gemini-3.1-flash-image-preview';
const RATIOS: Record<string, [number, number]> = { '1:1': [1, 1], '4:5': [4, 5], '9:16': [9, 16], '16:9': [16, 9] };
// A guide for the model, not a wall: Studio is for scenes, places, objects and textures; photos of the
// team are uploaded, never made up.
const GUIDE = 'You make images for Archy, a dental practice software company, used in marketing designs. Photographic, natural light, clean and modern. Do not depict real, identifiable people or add text, logos or watermarks unless asked.';

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return Response.json({ error: 'Sign in again.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const prompt = String(body.prompt ?? '').trim().slice(0, 1000);
  const ratio = RATIOS[body.ratio] ? String(body.ratio) : '4:5';
  if (prompt.length < 3) return Response.json({ error: 'Describe the image you want.' }, { status: 400 });
  const from = body.from ? await getAsset(String(body.from)) : null;
  if (body.from && !from) return Response.json({ error: 'Image not found.' }, { status: 404 });
  if (!(await useAi(me.id, 'generate'))) return Response.json({ error: `You made ${DAILY.generate} images today. Try again tomorrow.` }, { status: 429 });
  try {
    // An SVG goes as a PNG (the model reads raster images).
    const source = from ? (/\.svg$/i.test(from.path) ? await sourceFor(from).then((x) => ({ body: x.body!, type: x.type })) : await readAsset(from.path)) : null;
    const instruction = `${GUIDE}\n\n${source ? 'Edit this image: ' : 'Create an image: '}${prompt}\nAspect ratio ${ratio}.`;
    const result = await generateText({
      model: MODEL,
      messages: [{ role: 'user', content: [{ type: 'text', text: instruction }, ...(source ? [{ type: 'image' as const, image: source.body, mediaType: source.type }] : [])] }],
      providerOptions: { google: { imageConfig: { aspectRatio: ratio } } },
    });
    const file = result.files.find((f) => f.mediaType?.startsWith('image/'));
    if (!file) throw new Error(result.text?.trim() || 'No image came back. Try describing it differently.');
    // Exactly the ratio asked for (centre crop), as PNG.
    const sharp = (await import('sharp')).default;
    const img = sharp(Buffer.from(file.uint8Array), { limitInputPixels: MAX_PIXELS });
    const { width = 1024, height = 1024 } = await img.metadata();
    const [rw, rh] = RATIOS[ratio];
    const w = Math.min(width, Math.round((height * rw) / rh)), h = Math.min(height, Math.round((width * rh) / rw));
    const png = await img.extract({ left: Math.round((width - w) / 2), top: Math.round((height - h) / 2), width: w, height: h }).png().toBuffer();
    const name = from ? `${from.name} · edited` : prompt.length > 48 ? `${prompt.slice(0, 47)}…` : prompt;
    const asset = await createAsset({ ownerId: me.id, body: png, type: 'image/png', name, kind: 'generated', parentId: from?.id ?? null, prompt });
    return Response.json({ asset });
  } catch (e) {
    const msg = (e as Error).message;
    const setup = /auth|oidc|api key|unauthorized|403|401/i.test(msg);
    return Response.json({ error: setup ? 'Image generation is not set up yet (AI Gateway).' : msg }, { status: setup ? 503 : 400 });
  }
}
