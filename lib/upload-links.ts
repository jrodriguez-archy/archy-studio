// The app's own address for an uploaded image (/api/upload-file/<path>): the same on every server
// instance and for as long as the file exists, so the browser downloads a photo once and Canvas opens it
// from its cache afterwards. Signed in only (the uploads bucket stays private); the renderer, which has
// no session, keeps reading the file through a signed link.
export const UPLOAD_ROUTE = '/api/upload-file';

// A path inside the bucket: a folder and a file name, nothing that climbs out of it.
export const safeUploadPath = (p: string) => !/[\\\0-\x1f]/.test(p) && p.includes('/') && p.split('/').every((s) => s && s !== '.' && s !== '..');

// `doc`: a stand-in photo whose file is gone falls back to DOC's grey placeholder, not Archy's.
export const uploadLink = (path: string, doc = false) => `${UPLOAD_ROUTE}/${path.split('/').map(encodeURIComponent).join('/')}${doc ? '?doc=1' : ''}`;
