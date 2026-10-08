import { previewKey } from '@/lib/previews';
import { previewPath, publicUrl } from '@/lib/images';
import { supabaseConfigured } from '@/lib/supabase/admin';

// Catalog preview: the template format with its sample copy. A light route (no Chromium): it points the
// browser to the stored image, and only when that image does not exist yet sends it to the route that
// renders it once.
// Previews this server already saw stored (a stored preview never changes: a new version has a new key).
const stored = new Set<string>();

export async function GET(req: Request, { params }: { params: Promise<{ template: string; format: string }> }) {
  const { template, format } = await params;
  const key = await previewKey(template, format);
  if (!key) return new Response('Not found', { status: 404 });
  if (!supabaseConfigured()) return new Response('Previews need Supabase', { status: 503 });
  const url = publicUrl(previewPath(key));
  if (!stored.has(key)) {
    const head = await fetch(url, { method: 'HEAD', cache: 'no-store' }).catch(() => null);
    if (head?.ok) stored.add(key);
  }
  if (!stored.has(key)) return Response.redirect(new URL(`/api/preview-render/${template}/${format}`, req.url), 302);
  // A versioned link (?v= from previewSrc) always means this image: kept for a year. Without it (or with
  // an old version), only briefly, so a changed template or engine shows up at once.
  const current = new URL(req.url).searchParams.get('v') === key.split('-').pop();
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': current ? 'public, max-age=31536000, immutable' : 'public, max-age=60' } });
}
