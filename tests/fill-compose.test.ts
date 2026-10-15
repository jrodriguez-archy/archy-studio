import { describe, expect, it } from 'vitest';
import { compose, sanitize, withStableIds } from '@/lib/compose';
import { prepareFill } from '@/lib/fill';

// Template files and the brand kit are read from disk; nothing here reaches Supabase.

describe('prepareFill', () => {
  it('fills a template with its sample copy', async () => {
    const plan = await prepareFill({ template: 'booth-invite-photo', format: 'post', slots: {}, fillDefaults: true });
    expect(plan.width).toBe(1080);
    expect(plan.html).toBe('templates/booth-invite-photo/post.html');
  });
  it('reads a logo only from the template folders', async () => {
    const ok = await prepareFill({ template: 'booth-invite-photo', format: 'post', slots: { 'logo-partner': '../../brand-kit/archy/logo.svg' }, fillDefaults: true });
    expect(String(ok.fill.values['logo-partner'])).toMatch(/^data:image\/svg\+xml;base64,/);
    for (const v of ['../../package.json', '../../.env.local', '../../lib/fill.ts']) {
      await expect(prepareFill({ template: 'booth-invite-photo', format: 'post', slots: { 'logo-partner': v }, fillDefaults: true })).rejects.toThrow(/Unknown logo/);
    }
  });
});

const ids = (page: string) => [...page.matchAll(/data-name="([^"]+)"[^>]*data-node="(x[0-9a-z]+)"|data-node="(x[0-9a-z]+)"[^>]*data-name="([^"]+)"/g)]
  .map((m) => [m[1] ?? m[4], m[2] ?? m[3]]);

describe('compose', () => {
  const piece = (icon: string) => `<div data-name="Ground" style="position:absolute; inset:0; background: var(--color-royal-blue-500)"></div>
<span data-icon="${icon}" style="width:48px; height:48px"></span>
<h1 data-name="Headline" style="font-size:80px">Hello</h1>
<p data-name="Subline">World</p>`;

  it('keeps layer ids when an icon is unknown, so saved edits stay on their layers', async () => {
    const good = await compose({ html: piece('Calendar03Icon'), width: 1080, height: 1350, brand: 'archy' });
    const bad = await compose({ html: piece('NoSuchIcon'), width: 1080, height: 1350, brand: 'archy' });
    expect(good.problems).toEqual([]);
    expect(bad.problems[0]).toMatch(/Unknown icon "NoSuchIcon"/);
    const want = Object.fromEntries(ids(good.page));
    expect(want.Headline).toBeDefined();
    expect(Object.fromEntries(ids(bad.page))).toMatchObject({ Headline: want.Headline, Subline: want.Subline });
  });

  it('with stable ids, the kit\'s drawings never move the ids of the layers Claude wrote', async () => {
    const page = async (extra: string) => (await compose({ html: withStableIds(`${extra}${piece('Calendar03Icon')}`), width: 1080, height: 1350, brand: 'archy' })).page;
    const plain = Object.fromEntries(ids(await page('')));
    const withMascot = Object.fromEntries(ids(await page('<div data-piece="mascot" data-name="Mascot" style="width:300px"></div><div data-piece="logo" style="width:200px"></div>')));
    // Two more layers of its own (mascot, logo) come first: Claude's later layers shift by exactly two, not by the drawings' parts.
    const n = (v: string) => parseInt(v.slice(1), 36);
    expect(n(withMascot.Headline) - n(plain.Headline)).toBe(2);
    expect(n(withMascot.Subline) - n(plain.Subline)).toBe(2);
    const bad = Object.fromEntries(ids((await compose({ html: withStableIds(piece('NoSuchIcon')), width: 1080, height: 1350, brand: 'archy' })).page));
    expect(bad.Headline).toBe(plain.Headline);
    expect((await page('')).match(/<svg data-node="x[0-9a-z]+i"/)).not.toBeNull();
  });

  it('strips scripts and event handlers from the HTML', async () => {
    const c = await compose({ html: '<div data-name="A" onclick="alert(1)">Hi<script>alert(2)</script></div>', width: 1080, height: 1080, brand: 'archy' });
    expect(c.page).not.toMatch(/onclick|<script>alert/);
  });
});

describe('sanitize', () => {
  it('drops handlers and javascript: links however they are written', () => {
    for (const bad of [
      '<img src="x" onerror="alert(1)">',
      '<img src="x"/onerror="alert(1)">',
      '<img src="x"onerror="alert(1)">',
      "<svg/onload=alert(1)>",
      '<a href="java&#x73;cript:alert(1)">x</a>',
      '<a href="&#106;avascript:alert(1)">x</a>',
      '<a href=" java\tscript:alert(1)">x</a>',
      '<svg><a xlink:href="javascript:alert(1)">x</a></svg>',
      '<svg><animate attributeName="href" to="javascript:alert(1)"/></svg>',
      '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    ]) {
      const out = sanitize(bad);
      expect(out, bad).not.toMatch(/\bon[a-z]+\s*=|javascript|&#|<animate|<iframe|<script/i);
    }
  });
  it('keeps the design', () => {
    const ok = '<div data-name="Headline" style="color: red">Book a demo — online now</div><img data-image="asset:abc12345" src="https://example.com/a.png">';
    expect(sanitize(ok)).toBe(ok);
  });
});
