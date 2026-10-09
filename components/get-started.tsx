'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { dismissOnboardingAction } from '@/app/(app)/onboarding-actions';
import { Button } from '@/components/ui/button';
import type { OnboardingState } from '@/lib/onboarding';

// "Get started" above the gallery, for people new to Studio: three steps that tick themselves. Closing it,
// or seeing it complete, puts it away for good.
export function GetStarted({ state, brief, preview = false }: { state: OnboardingState; brief: string; preview?: boolean }) {
  const [open, setOpen] = useState(true);
  const [, start] = useTransition();
  if (!open) return null;
  // A preview (?preview=welcome) closes without remembering it.
  const close = () => { setOpen(false); if (!preview) start(() => dismissOnboardingAction()); };
  const copyBrief = async () => {
    try { await navigator.clipboard.writeText(brief); toast.success('Brief copied. Paste it in Claude.'); } catch { toast.error('Could not copy'); }
  };
  const { steps } = state;
  const done = [steps.claude, steps.design, steps.canvas].filter(Boolean).length;
  const current = !steps.claude ? 'claude' : !steps.design ? 'design' : !steps.canvas ? 'canvas' : null;
  const rows = [
    { key: 'claude', done: steps.claude, title: 'Connect Claude', text: 'Add Archy Studio to Claude once.', action: <Button size="lg" variant={current === 'claude' ? 'default' : 'outline'} nativeButton={false} render={<Link href="/docs/connect-claude" />}>How</Button> },
    { key: 'design', done: steps.design, title: 'Ask for your first design', text: 'Paste a brief in Claude, in your own words.', action: <Button size="lg" variant={current === 'design' ? 'default' : 'outline'} onClick={copyBrief}>Copy a brief</Button> },
    { key: 'canvas', done: steps.canvas, title: 'Open it in Canvas', text: 'Change copy, photos and colours by hand.', action: <Button size="lg" variant={current === 'canvas' ? 'default' : 'outline'} nativeButton={false} render={<Link href={state.latestPieceId ? `/canvas/${state.latestPieceId}` : '/canvas'} />}>Open Canvas</Button> },
  ];

  return (
    <section className="relative mb-8 rounded-xl border border-foreground/[0.08] bg-background p-5 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-6">
      <button type="button" onClick={close} aria-label="Close" title="Close" className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-md text-foreground/40 hover:bg-foreground/[0.05] hover:text-foreground">
        <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
      </button>
      <div className="mb-4 flex items-baseline gap-2 pr-8">
        <h2 className="text-[15px] font-medium">{state.complete ? 'You’re all set' : 'Get started'}</h2>
        <span className="text-foreground/40 tabular-nums">{done} of 3</span>
      </div>
      <ol className="divide-y divide-foreground/[0.06]">
        {rows.map((r) => (
          <li key={r.key} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
            <span className="flex min-w-0 flex-1 items-start gap-3">
              {r.done
                ? <HugeiconsIcon icon={CheckmarkCircle02Icon} className="mt-px size-[18px] shrink-0 text-[#16A34A]" />
                : <span className={`mt-px size-[18px] shrink-0 rounded-full border-[1.5px] ${current === r.key ? 'border-primary' : 'border-foreground/20'}`} aria-hidden />}
              <span className="min-w-0">
                <span className={`block font-medium ${r.done ? 'text-foreground/45 line-through decoration-foreground/20' : 'text-foreground'}`}>{r.title}</span>
                <span className="block text-foreground/50">{r.text}</span>
              </span>
            </span>
            {!r.done && <span className="pl-[30px] sm:pl-0">{r.action}</span>}
          </li>
        ))}
      </ol>
      <div className="mt-4 flex justify-end">
        <Link href="/docs" className="text-foreground/50 underline-offset-4 hover:text-foreground hover:underline">Read the Docs →</Link>
      </div>
    </section>
  );
}
