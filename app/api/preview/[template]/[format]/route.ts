import { previewKey } from '@/lib/previews';
import { previewPath, publicUrl } from '@/lib/images';
import { supabaseConfigured } from '@/lib/supabase/admin';

// Catalog preview: the template format with its sample copy. A light route (no Chromium): it points the
// browser to the stored image, and only when that image does not exist yet sends it to the route that
// renders it once. The redirect itself is cached, so a second visit does not even reach the server.
// Previews this server already saw stored (a stored preview never changes: a new version has a new key).
const stored = new Set<string>();

export async function GET(_req: Request, { params }: { params: Promise<{ template: string; format: string }> }) {
  const { template, format } = await params;
  const key = await previewKey(template, format);
  if (!key) return new Response('Not found', { status: 404 });
  if (!supabaseConfigured()) return new Response('Previews need Supabase', { status: 503 });
  const url = publicUrl(previewPath(key));
  if (!stored.has(key)) {
    const head = await fetch(url, { method: 'HEAD', cache: 'no-store' }).catch(() => null);
    if (head?.ok) stored.add(key);
  }
  if (!stored.has(key)) return Response.redirect(new URL(`/api/preview-render/${template}/${format}`, _req.url), 302);
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' } });
}
