import { DAILY, useAi } from '@/lib/assets';
import { extendPhoto, type Expand } from '@/lib/outpaint';
import { currentUser } from '@/lib/team';

export const runtime = 'nodejs';
export const maxDuration = 120;

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
    return Response.json(await extendPhoto({ template: body.template, image: body.image, expand, ownerId: me.id }));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
