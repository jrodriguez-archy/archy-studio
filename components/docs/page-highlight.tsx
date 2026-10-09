'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, ArrowUp01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { startsRe, wordsOf } from './search';

// A search result opened (?q=lease): every match in the section is highlighted (CSS Custom Highlight API,
// the page's text is not touched), the first one in view, and a small bar steps through them or clears.
export function PageHighlight() {
  const q = useSearchParams().get('q') ?? '';
  const path = usePathname();
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [at, setAt] = useState(0);
  const ranges = useRef<Range[]>([]);

  const show = useCallback((i: number, scroll = true) => {
    const all = ranges.current;
    if (!all.length || typeof CSS === 'undefined' || !('highlights' in CSS)) return;
    const n = (i + all.length) % all.length;
    setAt(n);
    CSS.highlights.set('docs-search-current', new Highlight(all[n]));
    if (scroll) (all[n].startContainer.parentElement as HTMLElement | null)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const words = wordsOf(q);
    const supported = typeof CSS !== 'undefined' && 'highlights' in CSS;
    if (supported) { CSS.highlights.delete('docs-search'); CSS.highlights.delete('docs-search-current'); }
    ranges.current = [];
    setCount(0);
    if (!words.length) return;
    // After the section has rendered (and the browser has jumped to its #heading).
    const t = setTimeout(() => {
      const article = document.querySelector('article');
      if (!article) return;
      const found: Range[] = [];
      const re = startsRe(words);
      const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        for (const m of (node.textContent ?? '').matchAll(re)) {
          const r = new Range(); r.setStart(node, m.index); r.setEnd(node, m.index + m[0].length); found.push(r);
        }
      }
      found.sort((a, b) => a.compareBoundaryPoints(Range.START_TO_START, b));
      ranges.current = found;
      setCount(found.length);
      if (!found.length || !supported) return;
      CSS.highlights.set('docs-search', new Highlight(...found));
      // From the heading the result pointed at, else the first match.
      const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
      const first = target ? Math.max(0, found.findIndex((r) => target.compareDocumentPosition(r.startContainer) & Node.DOCUMENT_POSITION_FOLLOWING)) : 0;
      show(first, !target);
    }, 250);
    return () => clearTimeout(t);
  }, [q, path, show]);

  const clear = useCallback(() => router.replace(`${path}${location.hash}`, { scroll: false }), [path, router]);
  useEffect(() => {
    if (!q) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement)) clear(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, clear]);

  if (!q) return null;
  return (
    <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
      <div className="flex max-w-full items-center gap-1 rounded-full bg-background/95 py-1 pr-1 pl-3.5 text-[13px] shadow-lg ring-1 ring-foreground/[0.08] backdrop-blur">
        <span className="min-w-0 truncate"><mark className="rounded-[2px] bg-[#FFE58F] px-1 text-inherit">{q}</mark></span>
        <span className="shrink-0 pl-1.5 text-foreground/50 tabular-nums">{count ? `${at + 1} of ${count}` : 'Not on this page'}</span>
        {count > 1 && (
          <>
            <button type="button" onClick={() => show(at - 1)} aria-label="Previous match" className="flex size-7 shrink-0 items-center justify-center rounded-full hover:bg-foreground/[0.06]"><HugeiconsIcon icon={ArrowUp01Icon} className="size-4" /></button>
            <button type="button" onClick={() => show(at + 1)} aria-label="Next match" className="flex size-7 shrink-0 items-center justify-center rounded-full hover:bg-foreground/[0.06]"><HugeiconsIcon icon={ArrowDown01Icon} className="size-4" /></button>
          </>
        )}
        <button type="button" onClick={clear} aria-label="Clear highlight" title="Clear (Esc)" className="flex size-7 shrink-0 items-center justify-center rounded-full text-foreground/50 hover:bg-foreground/[0.06] hover:text-foreground"><HugeiconsIcon icon={Cancel01Icon} className="size-4" /></button>
      </div>
    </div>
  );
}
