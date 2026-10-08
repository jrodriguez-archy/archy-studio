import { render } from '@/lib/renderer';
import { previewKey } from '@/lib/previews';
import { previewUrl } from '@/lib/renders';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Renders a catalog preview that is not stored yet (once per template version), then points to it.
// scripts/warm-previews.ts makes them all after a deploy, so people rarely land here.
export async function GET(_req: Request, { params }: { params: Promise<{ template: string; format: string }> }) {
  const { template, format } = await params;
  const key = await previewKey(template, format);
  if (!key) return new Response('Not found', { status: 404 });
  const url = await previewUrl(key, async () => (await render({ template, format, slots: {}, fillDefaults: true })).png);
  if (!url) return new Response('Previews need Supabase', { status: 503 });
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'public, max-age=86400' } });
}
