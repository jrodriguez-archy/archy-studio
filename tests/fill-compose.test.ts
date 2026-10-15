import { describe, expect, it } from 'vitest';
import { compose } from '@/lib/compose';
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

  it('strips scripts and event handlers from the HTML', async () => {
    const c = await compose({ html: '<div data-name="A" onclick="alert(1)">Hi<script>alert(2)</script></div>', width: 1080, height: 1080, brand: 'archy' });
    expect(c.page).not.toMatch(/onclick|<script>alert/);
  });
});
