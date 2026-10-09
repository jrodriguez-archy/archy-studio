import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

// A design's file link that works without signing in to Studio, for a while: what Claude downloads into
// the requester's folder (a plain fetch has no Studio session). Signed with the server's secret; the
// stable /api/file/<id> link (signed in) stays the one people keep.
const DAYS = 7;
const secret = () => process.env.FILE_LINK_SECRET || process.env.SUPABASE_SECRET_KEY || '';
const sign = (id: string, exp: number) => createHmac('sha256', secret()).update(`file:${id}:${exp}`).digest('base64url');

export function directFileLink(origin: string, id: string): string {
  const exp = Math.floor(Date.now() / 1000) + DAYS * 86400;
  return `${origin}/api/file/${id}?exp=${exp}&sig=${sign(id, exp)}`;
}

export function directFileOk(id: string, exp: string | null, sig: string | null): boolean {
  if (!secret() || !exp || !sig || !/^\d+$/.test(exp) || +exp < Date.now() / 1000) return false;
  const want = Buffer.from(sign(id, +exp)), got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

export const DIRECT_DAYS = DAYS;
