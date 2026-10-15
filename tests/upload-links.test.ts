import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { chromium, type Browser } from 'playwright-core';
import sharp from 'sharp';

// Uploaded photos in Canvas: one address per file on every server instance, so the browser downloads a
// photo once. Storage and the session are stood in for; each "instance" is a fresh load of the modules
// (nothing kept in memory between them, as on Vercel). The browser part needs Chromium.

const state = vi.hoisted(() => ({
  files: new Map<string, { body: Buffer; type: string }>(),
  base: 'http://127.0.0.1',
  signedIn: true,
  signs: 0,
}));

vi.mock('@/lib/supabase/admin', () => ({
  supabaseConfigured: () => true,
  supabaseAdmin: () => ({
    storage: {
      from: () => ({
        download: async (p: string) => {
          const f = state.files.get(p);
          return f ? { data: new Blob([new Uint8Array(f.body)], { type: f.type }), error: null } : { data: null, error: { message: 'Object not found' } };
        },
        // As Supabase does: a new token every time, so two instances never sign the same link.
        createSignedUrl: async (p: string) => {
          if (!state.files.has(p)) return { data: null, error: { message: 'Object not found' } };
          return { data: { signedUrl: `${state.base}/storage/v1/object/sign/uploads/${p}?token=${++state.signs}-${Math.random().toString(36).slice(2)}` }, error: null };
        },
      }),
    },
  }),
}));
vi.mock('@/lib/team', () => ({ currentUser: async () => (state.signedIn ? { id: 'u1', email: 'a@archy.com', full_name: null, is_admin: false } : null) }));
vi.mock('next/server', () => ({ after: () => {} }));

// A fresh server instance: its own copy of the modules, with nothing cached.
async function instance() {
  vi.resetModules();
  const [{ resolveImage, ORIGIN }, { GET }] = await Promise.all([import('@/lib/fill'), import('@/app/api/upload-file/[...path]/route')]);
  return { resolveImage, ORIGIN, GET };
}
type Instance = Awaited<ReturnType<typeof instance>>;
const canvas = (i: Instance, v: string) => i.resolveImage('booth-invite-photo', v, '/api/template-files');
const call = (i: Instance, url: string) => {
  const u = new URL(url, 'http://studio.test');
  return i.GET(new Request(u), { params: Promise.resolve({ path: u.pathname.replace('/api/upload-file/', '').split('/') }) });
};

const SMALL = 'u1/0b7c9a2e-small.jpg';
const BIG = 'u1/5d1e33aa-big.png';

beforeAll(async () => {
  state.files.set(SMALL, { body: await sharp({ create: { width: 64, height: 48, channels: 3, background: '#1e40af' } }).jpeg().toBuffer(), type: 'image/jpeg' });
  // Past what a function may answer: noise, so the PNG stays large.
  const noise = Buffer.from(Array.from({ length: 1400 * 1000 * 3 }, () => Math.floor(Math.random() * 256)));
  state.files.set(BIG, { body: await sharp(noise, { raw: { width: 1400, height: 1000, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer(), type: 'image/png' });
  expect(state.files.get(BIG)!.body.length).toBeGreaterThan(4_000_000);
});

describe('resolveImage', () => {
  it('gives Canvas the same address for an upload on every instance, without signing', async () => {
    const before = state.signs;
    const a = await canvas(await instance(), `upload:${SMALL}`);
    const b = await canvas(await instance(), `upload:${SMALL}`);
    expect(a).toBe(`/api/upload-file/${SMALL}`);
    expect(b).toBe(a);
    expect(state.signs).toBe(before);
  });
  it('keeps signed links for the renderer, which has no session', async () => {
    const i = await instance();
    expect(await i.resolveImage('booth-invite-photo', `upload:${SMALL}`, i.ORIGIN)).toMatch(/\/storage\/v1\/object\/sign\/uploads\/.+\?token=/);
  });
});

describe('/api/upload-file', () => {
  it('serves an upload for the browser to keep, privately', async () => {
    const res = await call(await instance(), `/api/upload-file/${SMALL}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, max-age=31536000, immutable');
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(Buffer.from(await res.arrayBuffer()).equals(state.files.get(SMALL)!.body)).toBe(true);
  });
  it('needs a session', async () => {
    state.signedIn = false;
    try {
      expect((await call(await instance(), `/api/upload-file/${SMALL}`)).status).toBe(401);
    } finally {
      state.signedIn = true;
    }
  });
  it('never leaves the bucket', async () => {
    const i = await instance();
    for (const p of ['..%2F..%2F.env.local', 'u1/..%2F..%2Fsecret', 'nofolder.jpg', 'u1//x.jpg']) expect((await call(i, `/api/upload-file/${p}`)).status).toBe(404);
  });
  it('sends a big file to storage by a redirect the browser keeps', async () => {
    const res = await call(await instance(), `/api/upload-file/${BIG}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toMatch(/\/storage\/v1\/object\/sign\/uploads\//);
    expect(res.headers.get('cache-control')).toMatch(/^private, max-age=\d+$/);
  });
  it('puts the neutral photo in place of a stand-in whose file is gone', async () => {
    const res = await call(await instance(), '/api/upload-file/placeholders/gone-unsplash.jpg?doc=1');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/api/template-files/library/placeholders/scene-doc.png');
  });
});

// The proof: Chromium opens the same photo twice, each time from a page another instance prepared (and
// answered), and the server sees one download. The signed links of before are the control: two downloads.
describe('in the browser', () => {
  let browser: Browser;
  let server: http.Server;
  const hits: string[] = [];
  let next = 0;
  let instances: Instance[] = [];

  beforeAll(async () => {
    instances = [await instance(), await instance()];
    server = http.createServer(async (req, res) => {
      const url = req.url!;
      // Pages: /page?src=<image address>
      if (url.startsWith('/page')) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(`<img src="${new URL(url, state.base).searchParams.get('src')}">`);
      }
      hits.push(url.split('?')[0]);
      if (url.startsWith('/api/upload-file/')) {
        // Each request may land on another instance.
        const r = await call(instances[next++ % instances.length], url);
        res.writeHead(r.status, Object.fromEntries(r.headers));
        return res.end(Buffer.from(await r.arrayBuffer()));
      }
      // Supabase's signed links: the file, kept for a year (storeUpload stores it so).
      const m = url.match(/^\/storage\/v1\/object\/sign\/uploads\/([^?]+)/);
      const f = m && state.files.get(decodeURIComponent(m[1]));
      if (!f) return res.writeHead(404).end();
      res.writeHead(200, { 'Content-Type': f.type, 'Cache-Control': 'max-age=31536000' });
      res.end(f.body);
    });
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
    state.base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    browser = await chromium.launch({ headless: true });
  });
  afterAll(async () => {
    await browser?.close();
    await new Promise((ok) => server?.close(ok));
  });

  // Opens the photo twice in one browser, each time as a different instance resolved it; returns how many
  // times the server was asked for anything but the pages.
  async function openTwice(resolve: (i: Instance) => Promise<string>) {
    hits.length = 0;
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      for (const i of instances) {
        const src = await resolve(i);
        await page.goto(`${state.base}/page?src=${encodeURIComponent(new URL(src, state.base).href)}`);
        await page.waitForFunction(() => document.images[0]?.complete && document.images[0].naturalWidth > 0);
      }
      return [...hits];
    } finally {
      await context.close();
    }
  }

  it('downloads an upload once across instances', async () => {
    expect(await openTwice((i) => canvas(i, `upload:${SMALL}`))).toEqual([`/api/upload-file/${SMALL}`]);
  });
  it('downloads a big upload once across instances, through the kept redirect', async () => {
    expect(await openTwice((i) => canvas(i, `upload:${BIG}`))).toEqual([`/api/upload-file/${BIG}`, `/storage/v1/object/sign/uploads/${BIG}`]);
  });
  it('control: signed links from two instances download it twice', async () => {
    const got = await openTwice((i) => i.resolveImage('booth-invite-photo', `upload:${SMALL}`, i.ORIGIN));
    expect(got).toEqual([`/storage/v1/object/sign/uploads/${SMALL}`, `/storage/v1/object/sign/uploads/${SMALL}`]);
  });
});
