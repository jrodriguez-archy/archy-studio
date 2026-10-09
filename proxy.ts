import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Every page needs a signed-in @archy.com session, except the login flow and the MCP surface
// (the MCP checks its own OAuth bearer token).
const PUBLIC = [/^\/login/, /^\/auth\//, /^\/mcp/, /^\/\.well-known\//];

export async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });
  // Refreshes the session cookie when needed.
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims?.sub;
  const path = req.nextUrl.pathname;
  if (!signedIn && !PUBLIC.some((r) => r.test(path))) {
    // A download link (/api/file/<id>, shared from Claude or the gallery) goes through the login first.
    if (path.startsWith('/api/') && !path.startsWith('/api/file/')) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(path + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  // Template files for Canvas and catalog previews are static brand assets: no session check.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/|textures/|api/template-files/|api/preview/|api/preview-render/).*)'],
};
