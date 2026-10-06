'use client';

import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Copy01Icon, Tick02Icon } from '@hugeicons/core-free-icons';

// Inline code you can copy with one click.
export function CopyText({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); }}
      className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-foreground/[0.05] px-1.5 py-0.5 align-baseline font-mono text-[12px] text-foreground transition-colors hover:bg-foreground/[0.08]"
    >
      <span className="truncate">{text}</span>
      <HugeiconsIcon icon={done ? Tick02Icon : Copy01Icon} className="size-3 shrink-0 text-foreground/40" />
    </button>
  );
}
