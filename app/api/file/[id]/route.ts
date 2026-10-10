import { titleOf } from '@/lib/catalog';
import { directFileOk } from '@/lib/file-links';
import { pngName } from '@/lib/file-names';
import { titleFromSlots } from '@/lib/gallery-shared';
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
  const [me, { data }] = await Promise.all([direct ? null : currentUser(), supabaseAdmin().from('renders').select('storage_path, archived_at, set_id, set_title, project_id, template, format, design, theme, width, height, slots').eq('id', id).maybeSingle()]);
  if (!me && !direct) return new Response('Sign in again.', { status: 401 });
  // The Archive page still downloads archived designs; a link shared before stops working.
  if (!data || (data.archived_at && new URL(req.url).searchParams.get('archived') !== '1')) return new Response('Not found', { status: 404 });
  return Response.redirect(await signedUrl(data.storage_path, 60 * 10, await nameOf(data)), 302);
}

// Saved as "<project>-<design's name>-<format>-<size>.png", the design's name as the gallery shows it.
async function nameOf(r: { set_id: string | null; set_title: string | null; project_id: string | null; template: string; format: string; design: string | null; theme: string | null; width: number; height: number; slots: Record<string, string | null> | null }) {
  const db = supabaseAdmin();
  const [set, project] = await Promise.all([
    !r.set_title && r.set_id ? db.from('renders').select('set_title').eq('set_id', r.set_id).not('set_title', 'is', null).limit(1).maybeSingle() : null,
    r.project_id ? db.from('projects').select('name').eq('id', r.project_id).maybeSingle() : null,
  ]);
  const title = r.set_title ?? set?.data?.set_title ?? titleFromSlots(r.slots ?? {}) ?? (await titleOf(r.template));
  return pngName({ project: project?.data?.name, title }, r);
}
