'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { morePiecesAction, setPiecesAction } from '@/app/(app)/gallery-actions';
import { PieceGrid } from '@/components/piece-grid';
import type { ProjectLink } from '@/components/projects-nav';
import { useRendersLive } from '@/components/use-renders-live';
import { PAGE, canManageSet, groupSets, type Piece, type PieceFilter } from '@/lib/gallery-shared';

// A gallery view (Gallery, a project, Archive): the newest designs first, older ones as the person
// scrolls. Live changes update only the sets that changed, so nothing else reloads.
export function GalleryFeed({ initial, filter, leadFormats, manageOnly, projects, me, showProject, empty }: {
  initial: Piece[]; filter: PieceFilter; leadFormats?: string[]; manageOnly?: boolean;
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
      <PieceGrid sets={sets} projects={projects} me={me} showProject={showProject} />
      {more && <div ref={end} className="h-px" aria-hidden />}
    </>
  );
}
