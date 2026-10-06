'use client';

import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { AiChat02Icon, ArrowUpRight01Icon } from '@hugeicons/core-free-icons';

// Claude, with each person's own account: the conversation happens in their Claude (app or web), where
// the Archy Studio connector reads and edits the piece open here; Canvas shows the changes live.
export function ClaudeTab({ pieceId, title, live }: { pieceId?: string; title?: string; live?: string | null }) {
  const [ask, setAsk] = useState('');
  const prompt = (q: string) => [
    `In Archy Studio Canvas, ${pieceId ? `on my piece "${title}" (canvas id ${pieceId})` : 'on the piece I have open'}: ${q.trim()}`,
    'Use the Archy Studio tools get_canvas and edit_canvas; keep it inside the brand.',
  ].join('\n');
  const open = () => { if (ask.trim()) window.open(`https://claude.ai/new?q=${encodeURIComponent(prompt(ask))}`, '_blank', 'noopener'); };
  return (
    <div className="space-y-4 px-3 pb-4 text-[12px]">
      <p className="text-foreground/55">Ask your Claude to change this piece. Claude works in your own Claude account, through the Archy Studio connector, and the changes appear here as it makes them. You can undo any of them.</p>
      {live && (
        <div className="flex items-center gap-2 rounded-md bg-[#E6F4FF] px-2.5 py-2 text-primary">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" /> {live}
        </div>
      )}
      <div className="space-y-2">
        <textarea value={ask} onChange={(e) => setAsk(e.target.value)} rows={4} placeholder="e.g. Make the headline shorter and switch to the light theme"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) open(); }}
          className="w-full resize-none rounded-md bg-foreground/[0.04] px-2.5 py-2 outline-none focus:ring-1 focus:ring-primary/40" />
        <button type="button" onClick={open} disabled={!ask.trim() || !pieceId}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-primary font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
          <HugeiconsIcon icon={AiChat02Icon} className="size-3.5" /> Ask Claude <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3" />
        </button>
        {!pieceId && <p className="text-foreground/40">Open or save a piece first, so Claude can find it.</p>}
      </div>
      <div className="space-y-1.5 border-t border-foreground/[0.06] pt-3 text-foreground/50">
        <p className="text-foreground">How it works</p>
        <p>1. Claude opens in a new tab with your request and this piece.</p>
        <p>2. It edits through the Archy Studio connector (install it once from the Install page).</p>
        <p>3. Keep this tab open: the piece updates live. Save when you like it.</p>
      </div>
    </div>
  );
}
