import { zipSync } from 'fflate';
import { formatLabel, groupSets } from '@/lib/gallery-shared';
import { titleOf } from '@/lib/catalog';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/team';

export const runtime = 'nodejs';
export const maxDuration = 60;

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'archy';

// Every format of one set as a ZIP of the 2x PNGs (signed-in team only).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await currentUser())) return new Response('Sign in first.', { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found.', { status: 404 });

  const db = supabaseAdmin();
  const { data } = await db.from('renders').select('id, set_id, template, format, storage_path, width, height, scale, slots, created_at, user_id, project_id').eq('set_id', id);
  if (!data?.length) return new Response('Not found.', { status: 404 });
  type Row = (typeof data)[number] & { storage_path: string };
  const rows = data as Row[];
  const titles = Object.fromEntries(await Promise.all([...new Set(rows.map((r) => r.template))].map(async (t) => [t, await titleOf(t)])));
  const [set] = groupSets(rows.map((r) => ({ ...r, title: titles[r.template], author: '', set_id: id })) as never);
  const path = Object.fromEntries(rows.map((r) => [r.id, r.storage_path]));

  const files: Record<string, Uint8Array> = {};
  await Promise.all(set.pieces.map(async (p) => {
    const { data: blob } = await db.storage.from('renders').download(path[p.id]);
    if (!blob) return;
    const name = `${slug(set.templates.length > 1 ? `${set.title}-${p.title}` : set.title)}-${slug(formatLabel(p.format))}.png`;
    files[name] = new Uint8Array(await blob.arrayBuffer());
  }));
  const zip = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, [v, { level: 0 }]])));
  return new Response(new Blob([zip as BlobPart]), {
    headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${slug(set.title)}.zip"` },
  });
}
