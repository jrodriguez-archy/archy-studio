import { NextResponse, type NextRequest } from 'next/server';
import { BRAND_COOKIE, isBrand } from '@/lib/brands';

// Switch brand and continue: a link to a DOC design or template opened while working in Archy (or the
// other way round) comes through here, so shared links keep working.
export function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get('to');
  const next = req.nextUrl.searchParams.get('next') ?? '/';
  const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const res = NextResponse.redirect(new URL(safe, req.url));
  if (isBrand(to)) res.cookies.set(BRAND_COOKIE, to, { path: '/', maxAge: 31536000, sameSite: 'lax' });
  return res;
}
