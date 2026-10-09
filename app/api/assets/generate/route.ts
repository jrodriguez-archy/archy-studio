import { DAILY, createAsset, getAsset, readAsset, sourceFor, useAi } from '@/lib/assets';
import { currentBrand } from '@/lib/brand';
import { RATIOS, generateImage } from '@/lib/generate';
import { currentUser } from '@/lib/team';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Generate an image (or edit one with instructions) through the Vercel AI Gateway (lib/generate.ts).
// The result joins the team's assets with its prompt.
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
    const png = await generateImage(prompt, ratio, source, await currentBrand());
    const name = from ? `${from.name} · edited` : prompt.length > 48 ? `${prompt.slice(0, 47)}…` : prompt;
    const asset = await createAsset({ ownerId: me.id, body: png, type: 'image/png', name, kind: 'generated', parentId: from?.id ?? null, prompt, folderId: typeof body.folder === 'string' ? body.folder : from?.folderId ?? null });
    return Response.json({ asset });
  } catch (e) {
    const msg = (e as Error).message;
    const setup = /auth|oidc|api key|unauthorized|403|401/i.test(msg);
    return Response.json({ error: setup ? 'Image generation is not set up yet (AI Gateway).' : msg }, { status: setup ? 503 : 400 });
  }
}
