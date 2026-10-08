'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { SearchVisualIcon, Image01Icon, Layers01Icon, LibraryIcon } from '@hugeicons/core-free-icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CanvasLibrary } from '@/lib/canvas';
import { StackBadge, StackLayers, stackPad } from '@/components/stack';
import { ResizeHandle, useSideWidth } from './resizable';

export type PanelTab = 'layers' | 'library' | 'assets' | 'inspector';
const TABS: { key: PanelTab; label: string; icon: typeof Layers01Icon }[] = [
  { key: 'layers', label: 'Content', icon: Layers01Icon },
  { key: 'library', label: 'Library', icon: LibraryIcon },
  { key: 'assets', label: 'Assets', icon: Image01Icon },
  { key: 'inspector', label: 'Inspector', icon: SearchVisualIcon },
];

// Canvas's own sidebar (Relume-like): a rail of tabs and the open tab.
export function CanvasPanel({ tab, onTab, badges = {}, children }: { tab: PanelTab; onTab: (t: PanelTab) => void; badges?: Partial<Record<PanelTab, number>>; children: React.ReactNode }) {
  const size = useSideWidth('canvas.left', 300, 260, 440);
  return (
    <aside ref={size.ref} data-panel className="relative flex shrink-0 border-r border-foreground/[0.06] bg-background max-md:hidden" style={{ width: size.width }}>
      <ResizeHandle side="left" width={size.width} onWidth={size.set} onReset={size.reset} />
      <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-foreground/[0.06] py-2">
        {TABS.map((t) => (
          <Tooltip key={t.key}>
            <TooltipTrigger render={<button type="button" onClick={() => onTab(t.key)} aria-label={t.label} aria-pressed={tab === t.key} />}
              className={`relative flex size-8 items-center justify-center rounded-md transition-colors ${tab === t.key ? 'bg-[#E6F4FF] text-primary' : 'text-foreground/45 hover:bg-foreground/[0.05] hover:text-foreground'}`}>
              <HugeiconsIcon icon={t.icon} className="size-4" strokeWidth={1.6} />
              {!!badges[t.key] && <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#D97706] px-1 text-[9px] font-semibold text-white">{badges[t.key]}</span>}
            </TooltipTrigger>
            <TooltipContent side="right">{t.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="shrink-0 px-3 pt-3 pb-1 text-[13px] font-medium">{TABS.find((t) => t.key === tab)?.label}</p>
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">{children}</div>
      </div>
    </aside>
  );
}

// Library: the designs to open (mine and the team's). New designs start with Claude, or from Templates.
export function LibraryTab({ library, current, updating = [], confirmLeave }: { library: CanvasLibrary; current?: string; updating?: string[]; confirmLeave: () => boolean }) {
  const router = useRouter();
  const [whose, setWhose] = useState<'mine' | 'team'>('mine');
  const go = (href: string) => { if (confirmLeave()) router.push(href); };
  const pieces = whose === 'mine' ? library.mine : library.team;
  return (
    <div className="pb-4 text-[12px]">
          <div role="tablist" aria-label="Whose designs" className="mx-3 mt-1 mb-3 grid h-8 grid-cols-2 gap-0.5 rounded-md bg-foreground/[0.05] p-0.5">
            {(['mine', 'team'] as const).map((w) => (
              <button key={w} type="button" role="tab" aria-selected={whose === w} onClick={() => setWhose(w)}
                className={`rounded-[5px] text-[12px] transition-colors ${whose === w ? 'bg-background font-medium text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.06)]' : 'text-foreground/50 hover:text-foreground'}`}>
                {w === 'mine' ? 'Mine' : 'Team'}
              </button>
            ))}
          </div>
          {!pieces.length && <p className="px-3 py-6 text-center text-foreground/45">No designs yet. Ask Claude for one, or open a template from Templates.</p>}
          <div className="grid grid-cols-2 gap-x-2 gap-y-3 px-3">
            {pieces.map((p) => {
              const n = p.ids.length;
              const open = !!current && p.ids.includes(current);
              return (
              <button key={p.id} type="button" onClick={() => go(`/canvas/${p.id}`)} className={`group text-left ${stackPad(n)}`}>
                {/* A set: its other formats stacked behind, as in the gallery. */}
                <div className="relative">
                <StackLayers n={n} />
                <div className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-md bg-[#F4F4F5] p-1.5 ring-1 transition-colors ${open ? 'ring-2 ring-primary' : 'ring-foreground/[0.06] group-hover:ring-primary/40'}`}>
                  <StackBadge n={n} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.thumb && <img src={p.thumb} alt="" loading="lazy" className="max-h-full max-w-full rounded-[2px]" style={{ aspectRatio: `${p.width} / ${p.height}` }} />}
                  {p.ids.some((id) => updating.includes(id)) && (
                    <span className="absolute inset-0 flex items-end justify-center bg-background/50 pb-1.5 backdrop-blur-[1px]">
                      <span className="animate-pulse rounded-full bg-background px-2 py-0.5 text-[10px] text-foreground/60 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">Updating…</span>
                    </span>
                  )}
                </div>
                </div>
                <p className="mt-1 truncate">{p.title}</p>
                <p className="truncate text-foreground/40">{p.format}{whose === 'team' ? ` · ${p.author}` : ''}</p>
              </button>
              );
            })}
          </div>
    </div>
  );
}

