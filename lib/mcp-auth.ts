import { createRemoteJWKSet, jwtVerify } from 'jose';

// Verifies the bearer token Claude sends to /mcp: a Supabase access token (ES256, project JWKS)
// for an @archy.com account. Returns what the tools need to attribute renders.
const issuer = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`;
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

export type McpAuthInfo = { token: string; clientId: string; scopes: string[]; expiresAt?: number; extra: { userId: string; email: string } };

export async function verifyMcpToken(_req: Request, token?: string): Promise<McpAuthInfo | undefined> {
  if (!token) return undefined;
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer });
    const email = String(payload.email ?? '');
    if (!payload.sub || !email.toLowerCase().endsWith('@archy.com')) return undefined;
    void markSeen(payload.sub);
    return {
      token,
      clientId: String(payload.client_id ?? 'supabase'),
      scopes: typeof payload.scope === 'string' ? payload.scope.split(' ') : [],
      expiresAt: payload.exp,
      extra: { userId: payload.sub, email },
    };
  } catch {
    return undefined;
  }
}

// Canvas shows whether the connector is in use: note the time, at most every 10 minutes per person,
// without holding up the request.
const lastMark = new Map<string, number>();
async function markSeen(userId: string) {
  const now = Date.now();
  if (now - (lastMark.get(userId) ?? 0) < 10 * 60 * 1000) return;
  lastMark.set(userId, now);
  try {
    const { supabaseAdmin } = await import('./supabase/admin');
    await supabaseAdmin().from('profiles').update({ mcp_seen_at: new Date(now).toISOString() }).eq('id', userId);
  } catch {
    // Not worth failing a tool call over.
  }
}
