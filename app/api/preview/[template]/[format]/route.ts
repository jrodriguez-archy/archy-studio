import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { render } from '@/lib/renderer';
import { previewUrl } from '@/lib/renders';
import { ROOT } from '@/lib/templates';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Catalog preview: the template format with its sample copy. Rendered once per template version
// (manifest hash) and kept in Storage; this route redirects to the stored image.
export async function GET(_req: Request, { params }: { params: Promise<{ template: string; format: string }> }) {
  const { template, format } = await params;
  if (!/^[a-z0-9-]+$/.test(template) || !/^[a-z]+$/.test(format)) return new Response('Not found', { status: 404 });
  let manifest: string;
  try {
    manifest = await fs.readFile(path.join(ROOT, 'templates', template, 'manifest.json'), 'utf8');
  } catch {
    return new Response('Not found', { status: 404 });
  }
  if (!(format in (JSON.parse(manifest).formats ?? {}))) return new Response('Not found', { status: 404 });
  const version = createHash('sha1').update(manifest).digest('hex').slice(0, 10);
  const url = await previewUrl(`${template}/${format}-${version}`, async () => (await render({ template, format, slots: {}, fillDefaults: true })).png);
  if (!url) return new Response('Previews need Supabase', { status: 503 });
  return Response.redirect(url, 302);
}
