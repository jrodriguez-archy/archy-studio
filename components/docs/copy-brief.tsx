'use client';

import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Copy01Icon, Tick02Icon } from '@hugeicons/core-free-icons';

// An example brief: the whole card copies it, ready to paste in Claude.
export function CopyBrief({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); }}
      className="group flex w-full items-start gap-3 rounded-lg bg-foreground/[0.04] px-4 py-3 text-left text-[14px] leading-[1.55] text-foreground/80 transition-colors hover:bg-foreground/[0.07]">
      <span className="min-w-0 flex-1">{text}</span>
      <span className="mt-0.5 flex shrink-0 items-center gap-1 text-[12px] text-foreground/40 group-hover:text-foreground/70">
        <HugeiconsIcon icon={done ? Tick02Icon : Copy01Icon} className="size-3.5" />{done ? 'Copied' : 'Copy'}
      </span>
    </button>
  );
}
