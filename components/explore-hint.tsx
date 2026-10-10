'use client';

import Link from 'next/link';
import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Copy01Icon, Tick02Icon } from '@hugeicons/core-free-icons';

// The clipboard, or the old way where it is not allowed (an embedded browser).
async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const t = document.createElement('textarea');
    t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  }
}

// Templates: for what the catalog does not have, an exploration (a brief to paste in Claude).
export function ExploreHint({ brief }: { brief: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-foreground/[0.04] px-4 py-2.5 text-[13px]">
      <span className="font-medium">Not in the catalog?</span>
      <span className="text-foreground/55">Ask Claude for an exploration.</span>
      <span className="ml-auto flex items-center gap-3">
        <Link href="/docs/explorations" className="text-foreground/55 underline underline-offset-4 hover:text-foreground">How it works</Link>
        <button type="button" title={brief}
          onClick={async () => { if (await copy(brief)) { setDone(true); setTimeout(() => setDone(false), 1400); } }}
          className="flex h-7 items-center gap-1.5 rounded-md bg-background px-2.5 text-foreground/80 shadow-[0_0_0_1px_rgba(0,0,0,0.06)] transition-colors hover:text-foreground">
          <HugeiconsIcon icon={done ? Tick02Icon : Copy01Icon} className="size-3.5" />{done ? 'Copied' : 'Copy a brief'}
        </button>
      </span>
    </div>
  );
}
