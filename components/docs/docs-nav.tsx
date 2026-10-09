'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, ArrowLeft01Icon, ArrowRight01Icon, Search01Icon } from '@hugeicons/core-free-icons';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { docHref, type DocSection } from '@/lib/docs';
import { loadIndex, marked, search, type Chunk } from './search';

const slugOf = (path: string) => path.replace(/^\/docs\/?/, '').split('/')[0] ?? '';

export function DocsIndex({ sections, onNavigate, autoFocus }: { sections: DocSection[]; onNavigate?: () => void; autoFocus?: boolean }) {
  const path = usePathname();
  const current = slugOf(path);
  const [q, setQ] = useState('');
  const [chunks, setChunks] = useState<Chunk[]>([]);
  // The text index loads the first time someone types.
  useEffect(() => { if (q.trim() && !chunks.length) loadIndex(sections).then(setChunks); }, [q, chunks.length, sections]);
  const hits = useMemo(() => (q.trim() ? search(sections, chunks, q) : null), [sections, chunks, q]);
  const input = useRef<HTMLInputElement>(null);
  // ⌘K / Ctrl-K searches the Docs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const groups = ['Start', 'Use', 'Reference'] as const;
  const go = () => { setQ(''); onNavigate?.(); };

  return (
    <nav className="space-y-5 text-[13px]" aria-label="Docs">
      <label className="flex h-8 items-center gap-2 rounded-md bg-foreground/[0.04] px-2.5 text-foreground/50 focus-within:bg-foreground/[0.06]">
        <HugeiconsIcon icon={Search01Icon} className="size-3.5 shrink-0" />
        <input ref={input} autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the docs" aria-label="Search the docs"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-foreground/40" />
        {!q && <kbd className="hidden font-sans text-[11px] text-foreground/35 lg:inline">⌘K</kbd>}
      </label>
      {hits ? (
        <div className="space-y-0.5">
          {hits.length ? hits.map((h) => (
            <Link key={h.href} href={h.href} onClick={go} className="block rounded-md px-2 py-1.5 hover:bg-foreground/[0.04]">
              <span className="block text-foreground"><Marked text={h.title} q={q} /></span>
              <span className="block text-[12px] text-foreground/40">{h.section}</span>
              {h.snippet && <span className="mt-0.5 line-clamp-2 block text-[12px] leading-[1.45] text-foreground/55"><Marked text={h.snippet} q={q} /></span>}
            </Link>
          )) : <p className="px-2 text-foreground/40">Nothing found.</p>}
        </div>
      ) : groups.map((g) => (
        <div key={g} className="space-y-0.5">
          <p className="px-2 pb-1 text-[11px] font-medium tracking-[0.02em] text-foreground/35">{g}</p>
          {sections.filter((s) => s.group === g).map((s) => (
            <Link key={s.slug} href={docHref(s.slug)} onClick={go} aria-current={current === s.slug ? 'page' : undefined}
              className={`block rounded-md px-2 py-1.5 transition-colors ${current === s.slug ? 'bg-foreground/[0.05] font-medium text-foreground' : 'text-foreground/60 hover:bg-foreground/[0.03] hover:text-foreground'}`}>
              {s.title}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

function Marked({ text, q }: { text: string; q: string }) {
  return <>{marked(text, q).map((p, i) => (i % 2 ? <mark key={i} className="rounded-[2px] bg-[#FFE58F] px-[1px] text-inherit">{p}</mark> : p))}</>;
}

// Below lg: a bar with the section's name that opens the index.
export function DocsBar({ sections }: { sections: DocSection[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const title = sections.find((s) => s.slug === slugOf(path))?.title ?? 'Docs';
  return (
    <div className="sticky top-[53px] z-30 -mx-4 mb-6 border-b border-foreground/[0.06] bg-background/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 md:top-0 lg:hidden">
      <button type="button" onClick={() => setOpen(true)} className="flex h-8 w-full items-center gap-2 rounded-md text-left text-[13px]">
        <span className="text-foreground/45">Docs</span>
        <span className="text-foreground/25">/</span>
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        <HugeiconsIcon icon={ArrowDown01Icon} className="size-4 text-foreground/40" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[300px] overflow-y-auto bg-[#FAFAFA] px-4 py-6">
          <SheetTitle className="px-2 pb-4 text-[15px] font-medium">Docs</SheetTitle>
          <DocsIndex sections={sections} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

// "On this page", lighting the heading being read.
export function OnThisPage({ sections }: { sections: DocSection[] }) {
  const path = usePathname();
  const section = sections.find((s) => s.slug === slugOf(path));
  const [active, setActive] = useState<string | null>(null);
  // The last heading that has reached the top part of the screen (any scroller: window or the app's).
  useEffect(() => {
    if (!section) return;
    const update = () => {
      const els = section.headings.map((h) => document.getElementById(h.id)).filter((e): e is HTMLElement => !!e);
      const passed = els.filter((e) => e.getBoundingClientRect().top < 140);
      // At the end of the page the last headings never reach the top: the last one in view.
      const page = document.scrollingElement;
      const atEnd = !!page && page.scrollTop > 0 && page.scrollTop + innerHeight >= page.scrollHeight - 2;
      const seen = atEnd ? els.filter((e) => e.getBoundingClientRect().top < innerHeight * 0.85) : passed;
      setActive((seen.at(-1) ?? els[0])?.id ?? null);
    };
    update();
    window.addEventListener('scroll', update, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', update, { capture: true });
  }, [section]);
  if (!section?.headings.length) return null;
  return (
    <nav className="space-y-1 text-[12px]" aria-label="On this page">
      <p className="pb-1 font-medium text-foreground/40">On this page</p>
      {section.headings.map((h) => (
        <a key={h.id} href={`#${h.id}`} className={`block py-0.5 transition-colors ${active === h.id ? 'text-foreground' : 'text-foreground/45 hover:text-foreground'}`}>{h.title}</a>
      ))}
    </nav>
  );
}

export function PrevNext({ sections }: { sections: DocSection[] }) {
  const path = usePathname();
  const i = sections.findIndex((s) => s.slug === slugOf(path));
  const prev = sections[i - 1], next = sections[i + 1];
  if (i < 0) return null;
  const card = 'flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg border border-foreground/[0.08] px-4 py-3 text-[14px] no-underline! transition-colors hover:bg-foreground/[0.02]';
  return (
    <div className="mt-14 flex flex-col gap-3 border-t border-foreground/[0.06] pt-6 sm:flex-row">
      {prev ? (
        <Link href={docHref(prev.slug)} className={card}>
          <span className="flex items-center gap-1 text-[12px] text-foreground/40"><HugeiconsIcon icon={ArrowLeft01Icon} className="size-3" />Previous</span>
          <span className="truncate font-medium text-foreground">{prev.title}</span>
        </Link>
      ) : <span className="hidden flex-1 sm:block" />}
      {next && (
        <Link href={docHref(next.slug)} className={`${card} sm:items-end sm:text-right`}>
          <span className="flex items-center gap-1 text-[12px] text-foreground/40">Next<HugeiconsIcon icon={ArrowRight01Icon} className="size-3" /></span>
          <span className="truncate font-medium text-foreground">{next.title}</span>
        </Link>
      )}
    </div>
  );
}
