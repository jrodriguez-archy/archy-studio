'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { morePiecesAction, setPiecesAction } from '@/app/(app)/gallery-actions';
import { BulkBar } from '@/components/bulk-bar';
import { PieceGrid, type Selection } from '@/components/piece-grid';
import { Button } from '@/components/ui/button';
import type { ProjectLink } from '@/components/projects-nav';
import { useRendersLive } from '@/components/use-renders-live';
import { PAGE, canManageSet, groupSets, type Piece, type PieceFilter } from '@/lib/gallery-shared';

// A gallery view (Gallery, a project, Archive): the newest designs first, older ones as the person
// scrolls. Live changes update only the sets that changed, so nothing else reloads.
// `selectable` (Archive) lets the person pick several sets and restore or delete them together.
export function GalleryFeed({ initial, filter, leadFormats, manageOnly, selectable, projects, me, showProject, empty }: {
  initial: Piece[]; filter: PieceFilter; leadFormats?: string[]; manageOnly?: boolean; selectable?: boolean;
  projects: ProjectLink[]; me: { id: string; is_admin: boolean }; showProject?: boolean; empty: React.ReactNode;
}) {
  const [pieces, setPieces] = useState(initial);
  const [more, setMore] = useState(initial.length >= PAGE);
  // A new server render (after an action, or new filters) starts over from it.
  useEffect(() => { setPieces(initial); setMore(initial.length >= PAGE); }, [initial]);

  const sets = useMemo(() => {
    const all = groupSets(pieces, leadFormats);
    return manageOnly ? all.filter((s) => canManageSet(s, me, projects)) : all;
  }, [pieces, leadFormats, manageOnly, me, projects]);

  // Picking: ⌘/Shift-click a card, or Select. Shift picks the range from the last one.
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const anchor = useRef<string | null>(null);
  const order = useRef<string[]>([]);
  order.current = sets.map((s) => s.id);
  const clear = useCallback(() => { setPicking(false); setPicked(new Set()); anchor.current = null; }, []);
  const toggle = useCallback((id: string, range: boolean) => {
    setPicking(true);
    const ids = order.current;
    const a = anchor.current ? ids.indexOf(anchor.current) : -1;
    const b = ids.indexOf(id);
    setPicked((now) => {
      const next = new Set(now);
      if (range && a >= 0 && b >= 0) for (const x of ids.slice(Math.min(a, b), Math.max(a, b) + 1)) next.add(x);
      else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    anchor.current = id;
  }, []);
  // Sets that leave the view (restored, deleted, live changes) leave the selection too.
  useEffect(() => {
    setPicked((now) => { const live = new Set(sets.map((s) => s.id)); const next = new Set([...now].filter((id) => live.has(id))); return next.size === now.size ? now : next; });
  }, [sets]);
  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[role=alertdialog]')) clear(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking, clear]);
  const selection: Selection | undefined = selectable ? { active: picking, ids: picked, toggle } : undefined;

  useRendersLive(async ({ sets: changed, deleted }) => {
    const fresh = await Promise.all(changed.map((id) => setPiecesAction(filter, id)));
    setPieces((now) => {
      const gone = new Set([...changed, ...deleted]);
      const kept = now.filter((p) => !gone.has(p.set_id) && !gone.has(p.id));
      return [...fresh.flat(), ...kept].sort((a, b) => b.created_at.localeCompare(a.created_at));
    });
  });

  // Older designs when the end of the grid comes into view.
  const end = useRef<HTMLDivElement>(null);
  const loading = useRef(false);
  useEffect(() => {
    const el = end.current;
    if (!el || !more) return;
    const io = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting || loading.current) return;
      loading.current = true;
      const before = pieces[pieces.length - 1]?.created_at;
      const next = before ? await morePiecesAction(filter, before) : [];
      setPieces((now) => [...now, ...next.filter((p) => !now.some((q) => q.id === p.id))]);
      setMore(next.length >= PAGE);
      loading.current = false;
    }, { rootMargin: '1200px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [pieces, more, filter]);

  if (!sets.length && !more) return <>{empty}</>;
  return (
    <>
      {selectable && (
        <div className="-mt-2 mb-4 flex justify-end">
          <Button variant="ghost" size="lg" onClick={() => (picking ? clear() : setPicking(true))}>{picking ? 'Done' : 'Select'}</Button>
        </div>
      )}
      <PieceGrid sets={sets} projects={projects} me={me} showProject={showProject} selection={selection} />
      {more && <div ref={end} className="h-px" aria-hidden />}
      {selectable && <BulkBar ids={[...picked]} total={sets.length} onSelectAll={() => setPicked(new Set(sets.map((s) => s.id)))} onClear={clear} onDone={clear} />}
    </>
  );
}
