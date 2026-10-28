import { createElement } from 'react';
// @ts-expect-error react-dom has no types installed here
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SECTIONS } from '@/components/docs/sections';
import { docsFor } from '@/lib/docs';

vi.mock('@/lib/team', () => ({ currentUser: async () => ({ is_admin: true, doc: false }) }));
const { generateMetadata } = await import('@/app/(app)/docs/[slug]/page');

describe('Docs by access', () => {
  it('hides DOC (its section and headings) from people without it', () => {
    const plain = docsFor(false, false);
    expect(plain.some((d) => d.slug === 'brands')).toBe(false);
    expect(plain.some((d) => d.slug === 'admin')).toBe(false);
    expect(plain.flatMap((d) => d.headings).some((h) => h.doc)).toBe(false);
    expect(JSON.stringify(plain)).not.toMatch(/\bDOC\b/);
  });

  it('shows DOC to people with it', () => {
    const doc = docsFor(true, true);
    expect(doc.some((d) => d.slug === 'brands')).toBe(true);
    expect(doc.find((d) => d.slug === '')!.headings.some((h) => h.id === 'brands')).toBe(true);
  });

  it('never says DOC in the text of the sections people without it see', () => {
    for (const d of docsFor(true, false)) {
      const html = renderToStaticMarkup(createElement(SECTIONS[d.slug], { doc: false }));
      expect(html, d.slug || 'overview').not.toMatch(/\bDOC\b|Dental Ownership/);
    }
  });

  it('does not name a DOC page in the tab title of someone without it', async () => {
    expect(await generateMetadata({ params: Promise.resolve({ slug: 'brands' }) })).toEqual({ title: 'Docs' });
    expect(await generateMetadata({ params: Promise.resolve({ slug: 'canvas' }) })).toEqual({ title: 'Canvas · Docs' });
  });
});
