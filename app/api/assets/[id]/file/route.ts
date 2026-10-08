import { getAsset, readAsset } from '@/lib/assets';
import { currentUser } from '@/lib/team';

// The full image, from this origin: shown large, drawn on a canvas (pixel effects), or downloaded.
// Served as an inert file: an SVG opened on its own can never run a script in Studio.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUser())) return new Response('Sign in again.', { status: 401 });
  const asset = await getAsset((await params).id);
  if (!asset) return new Response('Not found', { status: 404 });
  const file = await readAsset(asset.path).catch(() => null);
  if (!file) return new Response('Not found', { status: 404 });
  // ?download=1: saved with its name (Assets → View large → Download).
  const download = new URL(req.url).searchParams.has('download');
  const ext = asset.path.split('.').pop();
  const name = `${asset.name.replace(/·/g, '-').replace(/[\\/:*?"<>|\r\n]+/g, '').trim() || 'image'}.${ext}`;
  const ascii = name.normalize('NFD').replace(/[^\x20-\x7E]/g, '').replace(/"/g, '') || `image.${ext}`;
  return new Response(new Uint8Array(file.body), { headers: {
    'Content-Type': file.type, 'Cache-Control': 'private, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    ...(download ? { 'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}` } : {}),
  } });
}
