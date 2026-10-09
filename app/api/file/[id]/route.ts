import { signedUrl } from '@/lib/renders';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/team';

export const runtime = 'nodejs';

// A design's full-resolution PNG: signed when someone downloads it, so pages never sign files they
// only show. A stable link (/api/file/<id>) that redirects to a short-lived signed URL.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found', { status: 404 });
  // Who it is and which file, at the same time.
  const [me, { data }] = await Promise.all([currentUser(), supabaseAdmin().from('renders').select('storage_path').eq('id', id).maybeSingle()]);
  if (!me) return new Response('Sign in again.', { status: 401 });
  if (!data) return new Response('Not found', { status: 404 });
  return Response.redirect(await signedUrl(data.storage_path, 60 * 10), 302);
}
