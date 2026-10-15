import { NextResponse, type NextRequest } from 'next/server';
import { BRAND_COOKIE, isBrand } from '@/lib/brands';
import { safeNext } from '@/lib/safe-next';

// Switch brand and continue: a link to a DOC design or template opened while working in Archy (or the
// other way round) comes through here, so shared links keep working.
export function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get('to');
  const safe = safeNext(req.nextUrl.searchParams.get('next'));
  const res = NextResponse.redirect(new URL(safe, req.url));
  if (isBrand(to)) res.cookies.set(BRAND_COOKIE, to, { path: '/', maxAge: 31536000, sameSite: 'lax' });
  return res;
}
