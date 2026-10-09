import 'server-only';
import { MAX_PIXELS, createAsset } from './assets';
import type { Brand } from './brands';
import { supabaseAdmin, supabaseConfigured } from './supabase/admin';

// An image Claude passes as a link (https) is kept in Assets the first time it is used: a signed link
// (Notion, Drive, S3, Studio's own) stops working within minutes or hours, and a design must keep opening
// and rendering. The same file (same address without its query) is kept once and reused.
const MAX_FETCH = 30_000_000;
const MAX_STORE = 7_500_000; // storeUpload takes 8 MB at most

export async function keepLinkedImage(value: string, opts: { ownerId: string | null; brand: Brand; name: string }): Promise<string> {
  if (!/^https:\/\//i.test(value) || !opts.ownerId || !supabaseConfigured()) return value;
  const u = new URL(value);
  // Studio's own uploads, signed: the file is already kept.
  const own = process.env.NEXT_PUBLIC_SUPABASE_URL && value.startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL)
    ? u.pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/uploads\/(.+)$/) : null;
  if (own) return `upload:${decodeURIComponent(own[1])}`;
  const key = `link:${u.origin}${u.pathname}`.slice(0, 500);
  const db = supabaseAdmin();
  const { data: kept } = await db.from('assets').select('path').eq('prompt', key).eq('brand', opts.brand).is('deleted_at', null).limit(1).maybeSingle();
  if (kept?.path) return `upload:${kept.path}`;

  const res = await fetch(value, { headers: { 'User-Agent': 'Mozilla/5.0 ArchyStudio' }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!res?.ok) throw new Error(`Could not open the image at ${u.origin}${u.pathname} (${res?.status ?? 'no answer'}). The link may have expired: ask for the photo with request_photos.`);
  const type = res.headers.get('content-type')?.split(';')[0] ?? '';
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(type)) throw new Error(`The link at ${u.origin}${u.pathname} is not a PNG, JPG, WebP or SVG image.`);
  let body: Buffer = Buffer.from(await res.arrayBuffer());
  if (body.length > MAX_FETCH) throw new Error('The image at that link is larger than 30 MB.');
  let stored = type;
  if (body.length > MAX_STORE && type !== 'image/svg+xml') {
    // Too heavy to keep as it is: upright, 4000 px at most, PNG only where it is transparent.
    const sharp = (await import('sharp')).default;
    const img = sharp(body, { limitInputPixels: MAX_PIXELS }).rotate().resize({ width: 4000, height: 4000, fit: 'inside', withoutEnlargement: true });
    const alpha = (await sharp(body, { limitInputPixels: MAX_PIXELS }).metadata()).hasAlpha;
    body = alpha ? await img.png().toBuffer() : await img.jpeg({ quality: 90 }).toBuffer();
    stored = alpha ? 'image/png' : 'image/jpeg';
  }
  const asset = await createAsset({ ownerId: opts.ownerId, body, type: stored, name: opts.name, kind: 'upload', prompt: key, brand: opts.brand });
  return asset.value;
}
