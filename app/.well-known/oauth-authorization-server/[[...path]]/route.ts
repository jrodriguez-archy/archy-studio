// Some MCP clients look for the authorization server metadata on the MCP's own origin.
// Mirror Supabase's document so they find the same endpoints.
export async function GET() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/.well-known/oauth-authorization-server/auth/v1`, { next: { revalidate: 3600 } });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600' },
  });
}

export function OPTIONS() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': '*' } });
}
