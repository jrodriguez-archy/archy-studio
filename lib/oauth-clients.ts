// Where an MCP sign-in may send its code: Claude (web, and the apps' claude://claude.ai callback) and Claude
// Code on this computer.
// Anyone can register a client, so its name proves nothing; its redirect is what decides. More hosts can be
// added with OAUTH_ALLOWED_HOSTS (comma separated).
const HOSTS = ['claude.ai', 'claude.com', ...(process.env.OAUTH_ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)];
const LOOPBACK = ['localhost', '127.0.0.1', '[::1]'];

export function redirectHost(uri: string): string | null {
  try { return new URL(uri).hostname.toLowerCase(); } catch { return null; }
}

export function trustedRedirect(uri: string): boolean {
  let u: URL;
  try { u = new URL(uri); } catch { return false; }
  const host = u.hostname.toLowerCase();
  if (LOOPBACK.includes(host)) return u.protocol === 'http:' || u.protocol === 'https:';
  return (u.protocol === 'https:' || u.protocol === 'claude:') && HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}
