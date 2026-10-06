'use client';

import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { AiChat02Icon, Alert02Icon, ArrowUpRight01Icon, CheckmarkCircle02Icon, SearchVisualIcon } from '@hugeicons/core-free-icons';
import type { Suggestion } from '@/lib/canvas-shared';

// The Inspector: what looks off after the edits (cut off, outside the safe area, almost aligned,
// overlapping, hard to read, too small…). Suggestions only; the person decides. A click selects the
// component; Fix applies an exact nudge; an undo button puts back the design's value that the edit
// changed; what needs judgement (shorter copy, another colour, a new arrangement) goes to Claude.
export function InspectorTab({ items, onPick, onFix, onRevert, onFixAll, pieceId, title, seenAt }: {
  items: Suggestion[]; onPick: (id: string) => void; onFix: (s: Suggestion) => void; onRevert: (s: Suggestion) => void; onFixAll: () => void;
  pieceId?: string; title: string; seenAt: string | null;
}) {
  const connected = !!seenAt && Date.now() - new Date(seenAt).getTime() < 30 * 24 * 3600 * 1000;
  const askClaude = () => {
    const prompt = [
      `On my Archy Studio Canvas design "${title}" (canvas id ${pieceId}), the Inspector suggests:`,
      ...items.map((i) => `- ${i.title}: ${i.detail}`),
      'Use get_canvas and edit_canvas to fix them in the brand: keep the copy\'s meaning if you shorten it, use brand colours, keep things aligned.',
    ].join('\n');
    window.open(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`, '_blank', 'noopener');
  };
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
      <div className="mx-1 rounded-md bg-foreground/[0.03] p-2.5">
        <p className="text-foreground/60">Claude can take care of the ones that need judgement: shorter copy, another colour, a new arrangement.</p>
        {pieceId && connected ? (
          <button type="button" onClick={askClaude}
            className="mt-2 flex h-7 w-full items-center justify-center gap-1.5 rounded-md bg-foreground/[0.06] font-medium text-foreground/80 hover:bg-foreground/[0.1]">
            <HugeiconsIcon icon={AiChat02Icon} className="size-3.5" /> Ask Claude to fix <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3" />
          </button>
        ) : pieceId ? (
          <Link href="/install" className="mt-2 block text-primary underline-offset-4 hover:underline">Connect Claude first →</Link>
        ) : (
          <p className="mt-1.5 text-foreground/40">Save the design first, so Claude can find it.</p>
        )}
      </div>
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
                    {(s.fix || s.revert) && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); if (s.fix) onFix(s); else onRevert(s); }}
                        title={s.fix ? 'Put it back in line' : 'Back to the design’s value'}
                        className={`mt-1.5 h-6 rounded-md px-2 font-medium ${s.fix ? 'bg-[#E6F4FF] text-primary hover:bg-[#CCEAFF]' : 'bg-foreground/[0.06] text-foreground/75 hover:bg-foreground/[0.1]'}`}>
                        {s.fix ? 'Fix' : s.revert!.label}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
