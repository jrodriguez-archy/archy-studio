'use client';

import { docHref, type DocSection } from '@/lib/docs';

// The Docs' text, by heading, read from the section pages themselves the first time someone searches
// (a handful of small pages, kept for the visit), so search finds words in the text, not just titles.
export type Chunk = { slug: string; section: string; id: string | null; title: string; text: string };
let index: Promise<Chunk[]> | null = null;

export function loadIndex(sections: DocSection[]): Promise<Chunk[]> {
  index ??= Promise.all(sections.map(async (s) => {
    try {
      const html = await (await fetch(docHref(s.slug))).text();
      const article = new DOMParser().parseFromString(html, 'text/html').querySelector('article');
      if (!article) return [];
      const chunks: Chunk[] = [{ slug: s.slug, section: s.title, id: null, title: s.title, text: '' }];
      for (const el of [...article.children]) {
        if (el.tagName === 'H2' && el.id) chunks.push({ slug: s.slug, section: s.title, id: el.id, title: el.textContent?.replace(/#$/, '').trim() ?? '', text: '' });
        else chunks[chunks.length - 1].text += ` ${el.textContent ?? ''}`;
      }
      return chunks.map((c) => ({ ...c, text: c.text.replace(/\s+/g, ' ').trim() }));
    } catch {
      return [];
    }
  })).then((all) => all.flat());
  return index;
}

export const wordsOf = (q: string) => q.toLowerCase().trim().split(/\s+/).filter(Boolean);

// A term matches where a word in the text starts with it, as you type: "mid" finds Midwinter, "ide" finds
// idea. A term of one or two characters is that whole word: "id" finds ID, not idea, identity or Midwinter.
const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const term = (w: string) => `${esc(w)}${w.length <= 2 ? '(?![\\p{L}\\p{N}])' : ''}`;
export const startsRe = (words: string[], flags = 'giu') => new RegExp(`(?<![\\p{L}\\p{N}])(${words.map(term).join('|')})`, flags);

export type Hit = { href: string; title: string; section: string; snippet?: string };

// Titles first (sections, then headings), then the text: every word has to be there.
export function search(sections: DocSection[], chunks: Chunk[], q: string): Hit[] {
  const words = wordsOf(q);
  if (!words.length) return [];
  const res = words.map((w) => startsRe([w], 'iu'));
  const has = (t: string) => res.every((re) => re.test(t));
  const href = (slug: string, id: string | null) => `${docHref(slug)}?q=${encodeURIComponent(q.trim())}${id ? `#${id}` : ''}`;
  const hits: Hit[] = [];
  const seen = new Set<string>();
  const add = (h: Hit) => { if (!seen.has(h.href)) { seen.add(h.href); hits.push(h); } };
  for (const s of sections) if (has(`${s.title} ${s.summary} ${s.keywords ?? ''}`)) add({ href: href(s.slug, null), title: s.title, section: s.group });
  for (const s of sections) for (const h of s.headings) if (has(`${h.title} ${s.title}`)) add({ href: href(s.slug, h.id), title: h.title, section: s.title });
  for (const c of chunks) if (c.text && has(c.text)) add({ href: href(c.slug, c.id), title: c.title, section: c.section, snippet: snippet(c.text, res[0]) });
  return hits.slice(0, 15);
}

// A few words around the first match.
function snippet(text: string, re: RegExp) {
  const m = re.exec(text);
  const i = m?.index ?? 0, len = m?.[0].length ?? 0;
  const start = Math.max(0, text.lastIndexOf(' ', Math.max(0, i - 50)));
  const end = text.indexOf(' ', Math.min(text.length, i + len + 80));
  return `${start > 0 ? '…' : ''}${text.slice(start, end < 0 ? undefined : end).trim()}${end > 0 ? '…' : ''}`;
}

// Text with the searched words wrapped in <mark>.
export function marked(text: string, q: string) {
  const words = wordsOf(q);
  return words.length ? text.split(startsRe(words)) : [text];
}
