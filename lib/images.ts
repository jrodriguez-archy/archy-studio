import { supabaseAdmin } from './supabase/admin';

// Where people see designs. Thumbnails, large previews and catalog previews live in a public bucket:
// their paths carry random ids, so links are unguessable; they never change once written (a new version
// or a replacement gets a new path), so the browser and the CDN keep them for a year. Full-resolution
// PNGs stay private. (No image processing here, so pages that only show images stay light.)
export const PUBLIC = 'thumbs';

export const thumbPath = (path: string) => path.replace(/\.png$/, '.thumb.webp');
export const largePath = (path: string) => path.replace(/\.png$/, '.large.webp');
// Catalog previews: the key carries the manifest's hash, so a changed template gets a new file and link.
export const previewPath = (key: string) => `previews/${key}.webp`;

// Stable public links (no network call): the same URL on every page view, so it is cached.
export const publicUrl = (path: string) => supabaseAdmin().storage.from(PUBLIC).getPublicUrl(path).data.publicUrl;
export const thumbUrl = (storagePath: string) => publicUrl(thumbPath(storagePath));
export const largeUrl = (storagePath: string) => publicUrl(largePath(storagePath));
// The full PNG, signed when someone downloads it (stable app link: /api/file/<id>).
export const fileLink = (id: string) => `/api/file/${id}`;

export async function removeImages(storagePaths: string[]) {
  await supabaseAdmin().storage.from(PUBLIC).remove(storagePaths.flatMap((p) => [thumbPath(p), largePath(p)])).catch(() => {});
}
