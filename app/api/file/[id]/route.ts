import { directFileOk } from '@/lib/file-links';
import { signedUrl } from '@/lib/renders';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/team';

export const runtime = 'nodejs';

// A design's full-resolution PNG: signed when someone downloads it, so pages never sign files they
// only show. A stable link (/api/file/<id>) that redirects to a short-lived signed URL; it lasts until the
// design is archived or deleted (the Archive page asks for archived ones explicitly).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found', { status: 404 });
  // Who it is and which file, at the same time.
  const q = new URL(req.url).searchParams;
  // A direct link from Claude (signed, for a few days) needs no session; any other needs one.
  const direct = directFileOk(id, q.get('exp'), q.get('sig'));
  const [me, { data }] = await Promise.all([direct ? null : currentUser(), supabaseAdmin().from('renders').select('storage_path, archived_at').eq('id', id).maybeSingle()]);
  if (!me && !direct) return new Response('Sign in again.', { status: 401 });
  // The Archive page still downloads archived designs; a link shared before stops working.
  if (!data || (data.archived_at && new URL(req.url).searchParams.get('archived') !== '1')) return new Response('Not found', { status: 404 });
  return Response.redirect(await signedUrl(data.storage_path, 60 * 10), 302);
}
