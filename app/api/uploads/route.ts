import { createAsset, type AssetKind } from '@/lib/assets';
import { currentUser } from '@/lib/team';

export const runtime = 'nodejs';

// Vercel caps a request body at 4.5 MB.
const MAX = 4_000_000;
// Made in the browser from another asset (a pixel effect); everything else is an upload.
const KINDS: AssetKind[] = ['upload', 'pixel'];

// An image brought to Studio (Assets, a photo or partner logo in Canvas). It joins the team's assets.
// Returns its value for a design (upload:<path>), its thumbnail and the asset.
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return Response.json({ error: 'Sign in again.' }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'Choose an image.' }, { status: 400 });
  if (file.size > MAX) return Response.json({ error: 'The image is larger than 4 MB. Export it smaller and try again.' }, { status: 413 });
  const kind = KINDS.find((k) => k === form?.get('kind')) ?? 'upload';
  const parent = String(form?.get('parent') ?? '');
  const name = String(form?.get('name') ?? '') || file.name.replace(/\.\w+$/, '') || 'Image';
  try {
    const asset = await createAsset({ ownerId: me.id, body: Buffer.from(await file.arrayBuffer()), type: file.type, name, kind, parentId: /^[0-9a-f-]{36}$/i.test(parent) ? parent : null });
    return Response.json({ value: asset.value, url: asset.thumb, asset });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
