import { storeUpload } from '@/lib/renders';
import { currentUser } from '@/lib/team';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// Vercel caps a request body at 4.5 MB.
const MAX = 4_000_000;

// An image placed in Canvas (a new photo, a partner logo). Returns its value for the piece
// (upload:<path>) and a short-lived link to show it in the editor.
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return Response.json({ error: 'Sign in again.' }, { status: 401 });
  const file = (await req.formData().catch(() => null))?.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'Choose an image.' }, { status: 400 });
  if (file.size > MAX) return Response.json({ error: 'The image is larger than 4 MB. Export it smaller and try again.' }, { status: 413 });
  try {
    const value = await storeUpload(me.id, Buffer.from(await file.arrayBuffer()), file.type);
    const { data } = await supabaseAdmin().storage.from('uploads').createSignedUrl(value.slice(7), 60 * 60);
    return Response.json({ value, url: data?.signedUrl });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
