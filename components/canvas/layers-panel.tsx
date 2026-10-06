'use client';

import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowDown01Icon, ArrowRight01Icon, CursorRectangleSelection01Icon, FrameIcon, Image02Icon, LockIcon, MinusSignIcon,
  PaintBoardIcon, ShapesIcon, SparklesIcon, StarIcon, TagIcon, TextIcon, ViewIcon, ViewOffSlashIcon,
} from '@hugeicons/core-free-icons';
import type { Edits } from '@/lib/canvas-shared';
import type { Comp, Kind } from './model';

const ICON: Record<Kind, typeof TextIcon> = {
  text: TextIcon, button: CursorRectangleSelection01Icon, icon: StarIcon, photo: Image02Icon, partner: ShapesIcon, group: FrameIcon,
  archy: LockIcon, tag: TagIcon, line: MinusSignIcon, decoration: SparklesIcon, background: PaintBoardIcon,
};
export const KIND_LABEL: Record<Kind, string> = {
  text: 'Text', button: 'Button', icon: 'Icon', photo: 'Photo', partner: 'Logo', archy: 'Logo', group: 'Group',
  tag: 'Tag', line: 'Line', decoration: 'Decoration', background: 'Background',
};

// Layers, Relume-like: the piece as named groups (Content, Details, Header…) holding the components a
// person edits, in the order they read on the piece. "Name • Type"; copy from the brief in Archy blue.
export function LayersPanel({ comps, edits, selected, hover, onSelect, onHover, onToggle }: {
  comps: Comp[]; edits: Edits; selected: string[]; hover: string | null;
  onSelect: (id: string, add: boolean) => void; onHover: (id: string | null) => void; onToggle: (id: string) => void;
}) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const background = comps.find((c) => c.kind === 'background');
  const children = (pid: string | null) => comps.filter((c) => c.parent === pid && c.kind !== 'background');
  const edited = (c: Comp) => [c.id, c.textId, c.iconId].some((id) => id && edits[id] && Object.keys(edits[id]).length);

  const row = (c: Comp, depth: number): React.ReactNode => {
    const kids = children(c.id);
    const open = !closed.has(c.id);
    const hidden = !!edits[c.id]?.hidden;
    const active = selected.includes(c.id);
    const fromBrief = !!(c.slot || c.textSlot);
    return (
      <div key={c.id}>
        <div
          onClick={(e) => onSelect(c.id, e.metaKey || e.ctrlKey || e.shiftKey)}
          onMouseEnter={() => onHover(c.id)}
          onMouseLeave={() => onHover(null)}
          className={`group mx-1.5 flex h-7 cursor-default items-center gap-1.5 rounded-md pr-1.5 text-[12px] ${active ? 'bg-[#E6F4FF]' : hover === c.id ? 'bg-foreground/[0.04]' : 'hover:bg-foreground/[0.04]'}`}
          style={{ paddingLeft: 4 + depth * 14 }}
        >
          <button type="button" aria-label={open ? 'Collapse' : 'Expand'} onClick={(e) => { e.stopPropagation(); setClosed((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; }); }}
            className={`flex size-4 shrink-0 items-center justify-center rounded text-foreground/40 hover:text-foreground ${kids.length ? '' : 'invisible'}`}>
            <HugeiconsIcon icon={open ? ArrowDown01Icon : ArrowRight01Icon} className="size-3" strokeWidth={2} />
          </button>
          <HugeiconsIcon icon={ICON[c.kind]} className={`size-3.5 shrink-0 ${active ? 'text-primary' : 'text-foreground/35'}`} strokeWidth={1.6} />
          <span className={`min-w-0 flex-1 truncate ${hidden ? 'opacity-40' : ''}`}>
            <span className={fromBrief ? 'text-primary' : active ? 'text-foreground' : 'text-foreground/80'}>{c.name}</span>
            <span className="text-foreground/35"> • {KIND_LABEL[c.kind]}</span>
          </span>
          {edited(c) && <span className="size-1.5 shrink-0 rounded-full bg-primary/70" title="Edited" />}
          {c.kind === 'archy' ? (
            <HugeiconsIcon icon={LockIcon} className="size-3 shrink-0 text-foreground/30" strokeWidth={1.8} aria-label="Drawing locked" />
          ) : (
            <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(c.id); }} aria-label={hidden ? 'Show' : 'Hide'}
              className={`flex size-5 shrink-0 items-center justify-center rounded text-foreground/40 hover:text-foreground ${hidden ? '' : 'opacity-0 group-hover:opacity-100'}`}>
              <HugeiconsIcon icon={hidden ? ViewOffSlashIcon : ViewIcon} className="size-3.5" strokeWidth={1.6} />
            </button>
          )}
        </div>
        {open && kids.map((k) => row(k, depth + 1))}
      </div>
    );
  };

  return (
    <div className="py-2">
      {background && (
        <div onClick={(e) => onSelect(background.id, e.metaKey || e.ctrlKey)}
          className={`mx-1.5 mb-1 flex h-7 cursor-default items-center gap-1.5 rounded-md px-1 text-[12px] ${selected.includes(background.id) ? 'bg-[#E6F4FF]' : 'hover:bg-foreground/[0.04]'}`}>
          <span className="size-4 shrink-0" />
          <HugeiconsIcon icon={PaintBoardIcon} className="size-3.5 shrink-0 text-foreground/35" strokeWidth={1.6} />
          <span className="text-foreground/80">Background</span><span className="text-foreground/35"> • Artboard</span>
        </div>
      )}
      {children(null).map((c) => row(c, 0))}
    </div>
  );
}
