import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

// A design's file link that works without signing in to Studio, for a while: what Claude downloads into
// the requester's folder (a plain fetch has no Studio session). Signed with the server's secret; the
// stable /api/file/<id> link (signed in) stays the one people keep.
const DAYS = 7;
// Signed with its own secret (FILE_LINK_SECRET). Links made before it was set were signed with the
// Supabase key: those still open until they expire (7 days at most), so a link already shared keeps working.
const own = () => process.env.FILE_LINK_SECRET || '';
const legacy = () => process.env.SUPABASE_SECRET_KEY || '';
const sign = (key: string, id: string, exp: number) => createHmac('sha256', key).update(`file:${id}:${exp}`).digest('base64url');

export function directFileLink(origin: string, id: string): string {
  const exp = Math.floor(Date.now() / 1000) + DAYS * 86400;
  return `${origin}/api/file/${id}?exp=${exp}&sig=${sign(own() || legacy(), id, exp)}`;
}

export function directFileOk(id: string, exp: string | null, sig: string | null): boolean {
  if (!exp || !sig || !/^\d+$/.test(exp) || +exp < Date.now() / 1000) return false;
  const got = Buffer.from(sig);
  return [own(), legacy()].filter(Boolean).some((key) => {
    const want = Buffer.from(sign(key, id, +exp));
    return want.length === got.length && timingSafeEqual(want, got);
  });
}

export const DIRECT_DAYS = DAYS;
