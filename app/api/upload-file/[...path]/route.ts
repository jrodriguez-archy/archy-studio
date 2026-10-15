import { readAsset } from '@/lib/assets';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/team';
import { safeUploadPath } from '@/lib/upload-links';

export const runtime = 'nodejs';

// Past what a function may answer (about 4.5 MB): straight from storage, by a signed link.
const MAX_BODY = 4_000_000;
// A big file's redirect is kept by the browser for half a day and its signed link works for a whole one,
// so every instance's answer leads the browser back to the same link (and the photo it already has).
const REDIRECT_KEEP = 12 * 60 * 60;
const SIGNED_FOR = 24 * 60 * 60;

// An uploaded image at a stable address (see lib/upload-links.ts), for Canvas. Uploads get a new name per
// file and are never rewritten, so the browser keeps them for good; stand-in photos (placeholders/) can be
// stored again under the same name, so those for a day. `private`: never kept by a shared cache.
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!(await currentUser())) return new Response('Sign in again.', { status: 401 });
  const rel = (await params).path.map(decodeURIComponent).join('/');
  if (!safeUploadPath(rel)) return new Response('Not found', { status: 404 });
  const placeholder = rel.startsWith('placeholders/');
  const file = await readAsset(rel).catch(() => null);
  if (!file) {
    // A stand-in photo whose file is gone: the neutral one takes its place, so the design still opens.
    if (!placeholder) return new Response('Not found', { status: 404 });
    const doc = new URL(req.url).searchParams.has('doc');
    return new Response(null, { status: 302, headers: { Location: `/api/template-files/library/placeholders/scene${doc ? '-doc' : ''}.png`, 'Cache-Control': 'private, max-age=3600' } });
  }
  if (file.body.length > MAX_BODY && !rel.endsWith('.svg')) {
    const { data } = await supabaseAdmin().storage.from('uploads').createSignedUrl(rel, SIGNED_FOR);
    if (data) return new Response(null, { status: 302, headers: { Location: data.signedUrl, 'Cache-Control': `private, max-age=${REDIRECT_KEEP}` } });
  }
  return new Response(new Uint8Array(file.body), { headers: {
    'Content-Type': file.type, 'Cache-Control': placeholder ? 'private, max-age=86400' : 'private, max-age=31536000, immutable',
    // Served as an inert file: an SVG opened on its own can never run a script in Studio.
    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  } });
}
