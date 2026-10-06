'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
  CursorRectangleSelection01Icon, Image02Icon, LockIcon, MinusSignIcon, PaintBoardIcon, ShapesIcon, SparklesIcon,
  StarIcon, TagIcon, TextIcon, ViewIcon, ViewOffSlashIcon,
} from '@hugeicons/core-free-icons';
import type { Edits } from '@/lib/canvas-shared';
import { SECTIONS, type Comp, type Kind } from './model';

const ICON: Record<Kind, typeof TextIcon> = {
  text: TextIcon, button: CursorRectangleSelection01Icon, icon: StarIcon, photo: Image02Icon, partner: ShapesIcon,
  archy: LockIcon, tag: TagIcon, line: MinusSignIcon, decoration: SparklesIcon, background: PaintBoardIcon,
};

// Left column: the piece as the things a person edits (texts, the button, icons, photos, logos,
// shapes, the background), grouped. No frames, no groups. The Archy logo is listed, locked.
export function ComponentsPanel({ comps, edits, selected, onSelect, onToggle }: {
  comps: Comp[]; edits: Edits; selected: string | null; onSelect: (id: string) => void; onToggle: (id: string) => void;
}) {
  const edited = (c: Comp) => [c.id, c.textId, c.iconId].some((id) => id && edits[id] && Object.keys(edits[id]).length);
  return (
    <div className="space-y-4 py-3">
      {SECTIONS.map((s) => {
        const list = comps.filter((c) => s.kinds.includes(c.kind));
        if (!list.length) return null;
        return (
          <div key={s.title}>
            <p className="px-3 pb-1 text-[11px] font-medium tracking-[0.02em] text-foreground/40">{s.title}</p>
            {list.map((c) => {
              const hidden = !!edits[c.id]?.hidden;
              const active = c.id === selected;
              const locked = c.kind === 'archy';
              return (
                <div
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={`group mx-1.5 flex h-7 cursor-default items-center gap-2 rounded-md px-1.5 text-[12px] ${active ? 'bg-[#E6F4FF] text-primary' : 'text-foreground/75 hover:bg-foreground/[0.04]'}`}
                >
                  <HugeiconsIcon icon={ICON[c.kind]} className={`size-3.5 shrink-0 ${active ? 'text-primary' : 'text-foreground/35'}`} strokeWidth={1.6} />
                  <span className={`min-w-0 flex-1 truncate ${hidden ? 'opacity-40' : ''}`}>{c.name}</span>
                  {edited(c) && <span className="size-1.5 shrink-0 rounded-full bg-primary/70" title="Edited" />}
                  {!locked && c.kind !== 'background' && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onToggle(c.id); }}
                      aria-label={hidden ? 'Show' : 'Hide'}
                      className={`flex size-5 shrink-0 items-center justify-center rounded text-foreground/40 hover:text-foreground ${hidden ? '' : 'opacity-0 group-hover:opacity-100'}`}
                    >
                      <HugeiconsIcon icon={hidden ? ViewOffSlashIcon : ViewIcon} className="size-3.5" strokeWidth={1.6} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
