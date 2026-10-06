'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Alert02Icon, CheckmarkCircle02Icon, SearchVisualIcon } from '@hugeicons/core-free-icons';
import type { Suggestion } from '@/lib/canvas-shared';

// The Inspector: what looks off after the edits (cut off, outside the safe area, almost aligned,
// overlapping, hard to read, too small…). Suggestions only; the person decides. A click selects the
// component; Fix applies the nudge when there is one.
export function InspectorTab({ items, onPick, onFix, onFixAll }: { items: Suggestion[]; onPick: (id: string) => void; onFix: (s: Suggestion) => void; onFixAll: () => void }) {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-[12px] text-foreground/50">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-6 text-[#05C168]" strokeWidth={1.6} />
        <p className="text-[13px] font-medium text-foreground">All good</p>
        <p>Nothing looks off. The Inspector checks alignment, the safe area, overlaps and how easy texts are to read as you edit.</p>
      </div>
    );
  }
  const groups = [['warn', 'To look at'], ['tip', 'Suggestions']] as const;
  const fixable = items.filter((i) => i.fix).length;
  return (
    <div className="space-y-4 px-2 pb-4 text-[12px]">
      {fixable > 0 && (
        <button type="button" onClick={onFixAll}
          className="mx-1 flex h-8 w-[calc(100%-8px)] items-center justify-center gap-1.5 rounded-md bg-primary font-medium text-primary-foreground hover:opacity-90">
          Fix all ({fixable})
        </button>
      )}
      {groups.map(([level, title]) => {
        const list = items.filter((i) => i.level === level);
        if (!list.length) return null;
        return (
          <div key={level}>
            <p className="px-1 pb-1.5 text-[11px] font-medium tracking-[0.02em] text-foreground/40">{title} · {list.length}</p>
            <div className="space-y-1">
              {list.map((s, i) => (
                <div key={`${s.id}-${i}`} onClick={() => onPick(s.id)}
                  className="flex cursor-default gap-2 rounded-md px-2 py-2 hover:bg-foreground/[0.04]">
                  <HugeiconsIcon icon={level === 'warn' ? Alert02Icon : SearchVisualIcon} className={`mt-px size-3.5 shrink-0 ${level === 'warn' ? 'text-[#D97706]' : 'text-primary'}`} strokeWidth={1.8} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{s.title}</p>
                    <p className="text-foreground/50">{s.detail}</p>
                  </div>
                  {s.fix ? (
                    <button type="button" onClick={(e) => { e.stopPropagation(); onFix(s); }}
                      className="h-6 shrink-0 self-center rounded-md bg-[#E6F4FF] px-2 font-medium text-primary hover:bg-[#CCEAFF]">Fix</button>
                  ) : (
                    <span className="h-6 shrink-0 self-center px-1 text-[11px] leading-6 text-foreground/35">Select</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
