import { zipSync } from 'fflate';
import { pngName, zipName } from '@/lib/file-names';
import { groupSets } from '@/lib/gallery-shared';
import { signedUrls } from '@/lib/renders';
import { titleOf } from '@/lib/catalog';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/team';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Every format of one set as a ZIP of the 2x PNGs (signed-in team only). With ?list=1, only the file
// names and signed links: the browser fetches them side by side straight from storage and zips them
// itself (lib/download-set.ts), so nothing large passes through this function.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found.', { status: 404 });
  const db = supabaseAdmin();
  const [me, { data }] = await Promise.all([currentUser(), db.from('renders').select('id, set_id, set_title, template, format, design, theme, storage_path, width, height, scale, slots, created_at, user_id, project_id').eq('set_id', id)]);
  if (!me) return new Response('Sign in first.', { status: 401 });
  if (!data?.length) return new Response('Not found.', { status: 404 });
  type Row = (typeof data)[number] & { storage_path: string };
  const rows = data as Row[];
  const titles = Object.fromEntries(await Promise.all([...new Set(rows.map((r) => r.template))].map(async (t) => [t, await titleOf(t)])));
  const [set] = groupSets(rows.map((r) => ({ ...r, title: titles[r.template], author: '', set_id: id })) as never);
  const path = Object.fromEntries(rows.map((r) => [r.id, r.storage_path]));
  const { data: project } = set.project_id ? await db.from('projects').select('name').eq('id', set.project_id).maybeSingle() : { data: null };
  const named = { project: project?.name, title: set.title };
  // Options in other designs or themes get their own name (`…-the-arch-navy-post-1080x1350.png`).
  const nameOf = (p: (typeof set.pieces)[number]) => pngName(set.templates.length > 1 ? { ...named, title: `${set.title} ${p.title}` } : named, p);
  if (new URL(req.url).searchParams.get('list')) {
    const urls = await signedUrls(set.pieces.map((p) => path[p.id]), 60 * 10);
    return Response.json({ name: zipName(named), files: set.pieces.map((p) => ({ name: nameOf(p), url: urls[path[p.id]] })).filter((f) => f.url) });
  }

  const files: Record<string, Uint8Array> = {};
  await Promise.all(set.pieces.map(async (p) => {
    const { data: blob } = await db.storage.from('renders').download(path[p.id]);
    if (!blob) return;
    files[nameOf(p)] = new Uint8Array(await blob.arrayBuffer());
  }));
  const zip = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, [v, { level: 0 }]])));
  return new Response(new Blob([zip as BlobPart]), {
    headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${zipName(named)}"` },
  });
}
