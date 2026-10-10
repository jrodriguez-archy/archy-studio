'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { Download04Icon, PackageIcon, PaintBoardIcon, Tick02Icon } from '@hugeicons/core-free-icons';
import { DATE_TIME, DAY, LocalDate } from '@/components/local-date';
import { InfoRows, Inspector, StageImage, useInspector } from '@/components/inspector';
import type { ProjectLink } from '@/components/projects-nav';
import { ContextActions, MoreActions } from '@/components/action-menu';
import { useSetActions } from '@/components/set-actions';
import { StackBadge, StackLayers, stackPad } from '@/components/stack';
import { downloadSet } from '@/lib/download-set';
import { canManageSet, formatLabel, humanize, isExploration, type Piece, type PieceSet } from '@/lib/gallery-shared';

const formatsOf = (s: PieceSet) => [...new Set(s.pieces.map((p) => formatLabel(p.format)))].join(', ');

// Masonry of sets: everything made from one brief is one stacked card. A click opens the set in place
// with all its formats; right-click (or the ··· button) has every action for the set.
// With `selection` (Archive), ⌘/Shift-click picks sets, and while picking a click toggles instead of opening.
export type Selection = { active: boolean; ids: Set<string>; toggle: (id: string, range: boolean) => void };

export function PieceGrid({ sets, projects, me, showProject = true, selection }: { sets: PieceSet[]; projects: ProjectLink[]; me: { id: string; is_admin: boolean }; showProject?: boolean; selection?: Selection }) {
  const names = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const { openId, open, close, step } = useInspector('set', sets.map((s) => s.id));
  const current = sets.find((s) => s.id === openId);
  const [pick, setPick] = useState<string | null>(null);
  useEffect(() => setPick(null), [openId]);
  const shown = current ? current.pieces.find((p) => p.id === pick) ?? current.lead : null;
  // The open set's other formats load large in the background, so stepping through them is instant.
  useEffect(() => { for (const p of current?.pieces ?? []) if (p.large) new Image().src = p.large; }, [current]);
  // Stable, so opening a set does not redraw every card.
  const openRef = useRef(open);
  openRef.current = open;
  const onOpen = useCallback((id: string) => openRef.current(id), []);
  const toggleRef = useRef(selection?.toggle);
  toggleRef.current = selection?.toggle;
  const onToggle = useCallback((id: string, range: boolean) => toggleRef.current?.(id, range), []);

  return (
    <>
      <div className="columns-2 gap-4 md:columns-3 xl:columns-4">
        {sets.map((s, i) => (
          <SetCard key={s.id} set={s} eager={i < 8} projects={projects} canManage={canManageSet(s, me, projects)} project={showProject && s.project_id ? names[s.project_id] : undefined} onOpen={onOpen}
            selected={selection ? (selection.active ? selection.ids.has(s.id) : undefined) : undefined} onToggle={selection ? onToggle : undefined} />
        ))}
      </div>

      {current && shown && (
        <Inspector
          eyebrow={`${current.templates.length > 1 ? `${current.templates.length} templates` : current.lead.title} · ${current.pieces.length} format${current.pieces.length > 1 ? 's' : ''}`}
          title={current.title}
          onClose={close}
          onStep={step}
          stage={
            <div className="flex h-full w-full flex-col items-center gap-5" onClick={(e) => e.target === e.currentTarget && close()}>
              <div className="flex min-h-0 w-full flex-1 items-center justify-center" onClick={(e) => e.target === e.currentTarget && close()}>
                <StageImage src={shown.large ?? shown.thumb} placeholder={shown.thumb} alt={`${shown.title} ${formatLabel(shown.format)}`} width={shown.width} height={shown.height} />
              </div>
              {current.pieces.length > 1 && <Strip set={current} shown={shown} onPick={setPick} />}
            </div>
          }
          info={<SetInfo set={current} shown={shown} project={current.project_id ? names[current.project_id] : undefined} projects={projects} canManage={canManageSet(current, me, projects)} />}
        />
      )}
    </>
  );
}

// `selected` is undefined when the grid is not picking; `onToggle` is there when it can pick.
const SetCard = memo(function SetCard({ set: s, eager, projects, canManage, project, onOpen: openSet, selected, onToggle }: { set: PieceSet; eager: boolean; projects: ProjectLink[]; canManage: boolean; project?: string; onOpen: (id: string) => void; selected?: boolean; onToggle?: (id: string, range: boolean) => void }) {
  const onOpen = () => openSet(s.id);
  const picking = selected !== undefined;
  const onClick = (e: React.MouseEvent) => {
    if (onToggle && (picking || e.metaKey || e.ctrlKey || e.shiftKey)) { e.preventDefault(); onToggle(s.id, e.shiftKey); }
    else onOpen();
  };
  const { actions, dialogs } = useSetActions({ set: s, projects, canManage, onOpen });
  const r = s.lead;
  const n = s.pieces.length;
  return (
    <figure className={`group mb-4 break-inside-avoid ${stackPad(n)}`}>
      <ContextActions actions={actions} className="relative block">
        <StackLayers n={n} />
        <div className={`relative overflow-hidden rounded-lg bg-foreground/[0.04] ring-1 transition-shadow ${selected ? 'ring-2 ring-primary' : 'ring-foreground/[0.06]'}`}>
          {/* The large image starts loading on hover, so it is there when the set opens. */}
          <button type="button" onClick={onClick} onPointerEnter={() => { if (r.large && !picking) new Image().src = r.large; }} className={`block w-full select-none ${picking ? 'cursor-pointer' : 'cursor-zoom-in'}`}
            aria-pressed={picking ? selected : undefined} aria-label={picking ? `Select ${s.title}` : `Open ${s.title}, ${n} format${n > 1 ? 's' : ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.thumb} alt="" width={r.width} height={r.height} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} decoding="async" className={`block h-auto w-full ${s.archived_at ? 'opacity-60 grayscale' : ''}`} style={{ aspectRatio: `${r.width} / ${r.height}` }} />
          </button>
          <StackBadge n={n} />
          {isExploration(r.template) && !picking && (
            <span className="pointer-events-none absolute top-2 right-2 z-10 rounded-[4px] bg-background/85 px-1.5 py-0.5 text-[11px] font-medium text-foreground/70 shadow-sm backdrop-blur">Exploration</span>
          )}
          {picking && (
            <span aria-hidden className={`pointer-events-none absolute top-2 right-2 z-10 flex size-5 items-center justify-center rounded-full shadow-sm ring-1 transition-colors ${selected ? 'bg-primary text-primary-foreground ring-primary' : 'bg-background/80 ring-foreground/20 backdrop-blur'}`}>
              {selected && <HugeiconsIcon icon={Tick02Icon} strokeWidth={2.5} className="size-3" />}
            </span>
          )}
          {!picking && <div className="absolute right-2 bottom-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100 max-lg:opacity-100">
            <a href={n > 1 ? `/api/sets/${s.id}/zip` : r.file} onClick={(e) => { if (n > 1) { e.preventDefault(); downloadSet(s.id); } }} aria-label={n > 1 ? 'Download all formats' : 'Download PNG'} title={n > 1 ? 'Download all formats' : 'Download PNG'}
              className="flex size-7 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur">
              <HugeiconsIcon icon={Download04Icon} className="size-3.5" />
            </a>
            <MoreActions actions={actions} />
          </div>}
        </div>
      </ContextActions>
      <figcaption className="mt-1.5 px-0.5 text-[13px]">
        <div className="truncate">{s.title}</div>
        <div className="truncate text-foreground/40">{s.templates.length > 1 ? `${s.templates.length} templates` : r.title} · {formatsOf(s)}</div>
        <div className="truncate text-foreground/40">
          {s.author} · <LocalDate iso={s.archived_at ?? s.created_at} opts={DAY} />{s.archived_at ? ' · archived' : ''}
          {project && <> · {project}</>}
        </div>
      </figcaption>
      {dialogs}
    </figure>
  );
});

// Thumbnails of every format in the set, to switch the one on the stage.
function Strip({ set, shown, onPick }: { set: PieceSet; shown: Piece; onPick: (id: string) => void }) {
  return (
    <div className="flex max-w-full shrink-0 items-end gap-2 overflow-x-auto rounded-xl bg-background/70 p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-foreground/[0.06] backdrop-blur [scrollbar-width:none]">
      {set.pieces.map((p) => (
        <button key={p.id} type="button" onClick={() => onPick(p.id)} title={`${p.title} · ${formatLabel(p.format)}`}
          className={`flex shrink-0 flex-col items-center gap-1 rounded-md p-1 transition-colors ${p.id === shown.id ? 'bg-[#E6F4FF]' : 'hover:bg-foreground/[0.05]'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.thumb} alt="" decoding="async" className="h-12 w-auto rounded-[2px] ring-1 ring-foreground/[0.08]" style={{ aspectRatio: `${p.width} / ${p.height}` }} />
          <span className={`text-[11px] ${p.id === shown.id ? 'font-medium text-primary' : 'text-foreground/50'}`}>{formatLabel(p.format)}</span>
        </button>
      ))}
    </div>
  );
}

function SetInfo({ set, shown, project, projects, canManage }: { set: PieceSet; shown: Piece; project?: string; projects: ProjectLink[]; canManage: boolean }) {
  const { actions, dialogs } = useSetActions({ set, projects, canManage });
  // The copy of the brief (from the format on stage); images and logos are listed as provided, links are not shown.
  const copy = Object.entries(shown.slots).filter(([, v]) => v);
  const rank = (k: string) => { const i = ['kicker', 'headline', 'subhead', 'speaker', 'name', 'role', 'company', 'city', 'venue', 'date', 'time', 'booth'].findIndex((p) => k.startsWith(p)); return i < 0 ? 99 : i; };
  const text = copy.filter(([, v]) => !/^(https?:|asset:|upload:|data:|\[inline image\])/.test(v!)).sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
  const media = copy.filter(([, v]) => /^(https?:|asset:|upload:|data:|\[inline image\])/.test(v!)).map(([k]) => humanize(k.replace(/^(image|logo)-/, '')));
  const many = set.pieces.length > 1;

  return (
    <div className="space-y-6">
      <div className={`grid gap-1.5 [&>*]:justify-center ${many ? 'grid-cols-2' : 'grid-cols-2'}`}>
        {many ? (
          <a href={`/api/sets/${set.id}/zip`} onClick={(e) => { e.preventDefault(); downloadSet(set.id); }} className="col-span-2 flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90">
            <HugeiconsIcon icon={PackageIcon} className="size-3.5" /> Download all ({set.pieces.length})
          </a>
        ) : null}
        {shown.file && (
          <a href={shown.file} className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] transition-colors ${many ? 'bg-foreground/[0.05] text-foreground/80 hover:bg-foreground/[0.09]' : 'bg-primary font-medium text-primary-foreground hover:opacity-90'}`}>
            <HugeiconsIcon icon={Download04Icon} className="size-3.5" /> {many ? formatLabel(shown.format) : 'Download'}
          </a>
        )}
        <MoreActions actions={actions} label="More" className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-foreground/[0.05] px-3 text-[13px] text-foreground/80 transition-colors outline-none hover:bg-foreground/[0.09]" />
        <Link href={`/canvas/${shown.id}`} className="col-span-2 flex h-8 items-center gap-1.5 rounded-md bg-foreground/[0.05] px-3 text-[13px] text-foreground/80 transition-colors hover:bg-foreground/[0.09]">
          <HugeiconsIcon icon={PaintBoardIcon} className="size-3.5" /> Edit in Canvas{many ? ` · ${formatLabel(shown.format)}` : ''}
        </Link>
      </div>
      {dialogs}

      <section>
        <p className="pb-1.5 text-foreground/40">Formats</p>
        <InfoRows
          rows={set.pieces.map((p) => [
            formatLabel(p.format),
            <span key={p.id} className="flex items-center justify-end gap-2">
              <span className="text-foreground/50">{p.width}×{p.height}{set.templates.length > 1 ? ` · ${p.title}` : ''}</span>
              {p.file && (
                <a href={p.file} aria-label={`Download ${formatLabel(p.format)}`} title="Download PNG" className="text-foreground/40 transition-colors hover:text-foreground">
                  <HugeiconsIcon icon={Download04Icon} className="size-3.5" />
                </a>
              )}
            </span>,
          ])}
        />
      </section>

      <InfoRows
        rows={[
          ['Template', set.templates.length > 1 ? `${set.templates.length} templates` : isExploration(set.lead.template) ? 'Exploration (no template)' : <Link key="t" href={`/templates?t=${set.lead.template}`} className="underline decoration-foreground/20 underline-offset-4 hover:decoration-foreground">{set.lead.title}</Link>],
          ['File', `PNG @${shown.scale}x`],
          ['Project', project ?? '—'],
          ['Made by', set.author],
          ['Created', <LocalDate key="c" iso={set.created_at} opts={DATE_TIME} />],
        ]}
      />

      {text.length > 0 && (
        <section>
          <p className="pb-1.5 text-foreground/40">Copy</p>
          <InfoRows rows={text.map(([k, v]) => [humanize(k), v])} />
        </section>
      )}
      {media.length > 0 && <p className="text-foreground/40">Images: {media.join(', ')}</p>}
    </div>
  );
}
