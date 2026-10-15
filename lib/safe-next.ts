// Where to go after signing in or switching brand: a path of this app only. "/\evil.com" or "/<tab>/evil.com"
// start with one slash but browsers read them as another site, so the path is resolved and must stay here.
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || /[\\\0-\x1f\x7f]/.test(next)) return fallback;
  try {
    const base = 'https://studio.invalid';
    const u = new URL(next, base);
    return u.origin === base ? `${u.pathname}${u.search}${u.hash}` : fallback;
  } catch {
    return fallback;
  }
}
