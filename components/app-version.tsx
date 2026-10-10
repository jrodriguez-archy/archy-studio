'use client';

import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Refresh01Icon } from '@hugeicons/core-free-icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebar } from '@/components/sidebar';
import { ROW } from '@/components/nav-link';

const BUILD = process.env.NEXT_PUBLIC_BUILD;
const VERSION = process.env.NEXT_PUBLIC_VERSION;
const EVERY = 10 * 60_000;

// Update, above the sidebar's foot: shows when a newer deploy is out while the page is open, and reloads
// into it. It asks /api/version on coming back to the tab and every 10 minutes.
export function AppUpdate() {
  const { collapsed } = useSidebar();
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    if (BUILD === 'dev') return;
    let last = 0;
    const check = async () => {
      if (document.hidden || Date.now() - last < 30_000) return;
      last = Date.now();
      try {
        const r = await fetch('/api/version', { cache: 'no-store' });
        if (!r.ok) return;
        const v: { build?: string; version?: string } = await r.json();
        if (v.build && v.build !== BUILD) setNext(v.version ?? '');
      } catch {}
    };
    const timer = setInterval(check, EVERY);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(timer); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, []);

  const label = next && next !== VERSION ? `Update to ${next}` : 'Update';
  const update = next !== null && (collapsed ? (
    <Tooltip>
      <TooltipTrigger render={<button type="button" onClick={() => location.reload()} aria-label={label} />}
        className={`${ROW} w-full justify-center px-0 text-primary hover:bg-primary/[0.08]`}>
        <HugeiconsIcon icon={Refresh01Icon} className="size-4" strokeWidth={1.8} />
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  ) : (
    <button type="button" onClick={() => location.reload()}
      className={`${ROW} w-full bg-primary/[0.08] font-medium text-primary hover:bg-primary/[0.13]`}>
      <HugeiconsIcon icon={Refresh01Icon} className="size-4 shrink-0" strokeWidth={1.8} />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
    </button>
  ));

  return update ? <div className="pb-3">{update}</div> : null;
}
