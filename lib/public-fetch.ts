import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

// An image someone gave as a link is fetched only from the public internet: never the server's own network
// (localhost, a private range, cloud metadata), whatever the name resolves to and wherever it redirects.

const V4: [number, number][] = [
  [0x00000000, 8], [0x0a000000, 8], [0x64400000, 10], [0x7f000000, 8], [0xa9fe0000, 16], [0xac100000, 12],
  [0xc0000000, 24], [0xc0a80000, 16], [0xc6120000, 15], [0xe0000000, 4], [0xf0000000, 4],
];

export function privateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const n = ip.split('.').reduce((a, p) => a * 256 + Number(p), 0);
    return V4.some(([base, bits]) => (n >>> (32 - bits)) === (base >>> (32 - bits)));
  }
  if (v === 6) {
    const a = ip.toLowerCase();
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return privateAddress(mapped[1]);
    return a === '::' || a === '::1' || /^f[cd]/.test(a) || /^fe[89ab]/.test(a) || a.startsWith('::ffff:');
  }
  return true; // not an address at all: never trusted
}

async function check(u: URL) {
  if (u.protocol !== 'https:') throw new Error(`Only https links (${u.origin}).`);
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (!addresses.length) throw new Error(`No server at ${u.host}.`);
  if (addresses.some(privateAddress)) throw new Error(`The image at ${u.origin} is not on a public address.`);
}

/** fetch for a link from a person or Claude: public https addresses only, each redirect checked again. */
export async function publicFetch(url: string, init: RequestInit = {}, hops = 4): Promise<Response> {
  const u = new URL(url);
  await check(u);
  const res = await fetch(u, { ...init, redirect: 'manual' });
  const to = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
  if (!to) return res;
  if (hops <= 0) throw new Error(`Too many redirects from ${u.origin}.`);
  return publicFetch(new URL(to, u).toString(), init, hops - 1);
}
