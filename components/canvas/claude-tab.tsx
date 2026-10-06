'use client';

import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { AiChat02Icon, ArrowRight01Icon, ArrowUpRight01Icon, Copy01Icon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import { copy } from '@/components/action-menu';

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};

// Claude, with each person's own account: the conversation happens in their Claude (app or web), where
// the Archy Studio connector reads and edits the piece open here; Canvas shows the changes live.
export function ClaudeTab({ pieceId, title, live, seenAt }: { pieceId?: string; title?: string; live?: string | null; seenAt?: string | null }) {
  const connected = !!seenAt && Date.now() - new Date(seenAt).getTime() < 30 * 24 * 3600 * 1000;
  const start = `On my Archy Studio Canvas piece "${title ?? ''}" (canvas id ${pieceId}): `;
  return (
    <div className="space-y-4 px-3 pb-4 text-[12px]">
      <div className={`flex items-start gap-2 rounded-md px-2.5 py-2 ${connected ? 'bg-[#DEF2E6] text-[#11845B]' : 'bg-foreground/[0.04] text-foreground/60'}`}>
        <span className={`mt-1 size-1.5 shrink-0 rounded-full ${connected ? 'bg-[#05C168]' : 'bg-foreground/30'}`} />
        <p>{connected ? <>Connected to your Claude · used {ago(seenAt!)}</> : 'Not connected to your Claude yet'}</p>
      </div>

      {live && (
        <div className="flex items-center gap-2 rounded-md bg-[#E6F4FF] px-2.5 py-2 text-primary">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" /> {live}
        </div>
      )}

      {connected ? (
        <div className="space-y-2">
          <p className="text-foreground/55">Tell Claude what to change. It edits this piece and you see it here as it happens; undo anything you don’t like.</p>
          <button type="button" disabled={!pieceId} onClick={() => window.open(`https://claude.ai/new?q=${encodeURIComponent(start)}`, '_blank', 'noopener')}
            className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-primary font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            <HugeiconsIcon icon={AiChat02Icon} className="size-3.5" /> Open Claude <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3" />
          </button>
          {pieceId ? (
            <button type="button" onClick={async () => { if (await copy(pieceId)) toast.success('Canvas id copied'); }}
              className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md text-foreground/55 hover:bg-foreground/[0.05] hover:text-foreground">
              <HugeiconsIcon icon={Copy01Icon} className="size-3" /> Copy this piece’s id
            </button>
          ) : (
            <p className="text-foreground/40">Save the piece first, so Claude can find it.</p>
          )}
        </div>
      ) : (
        <ol className="space-y-2 text-foreground/60">
          <li><span className="text-foreground">1.</span> Add the Archy Studio connector to your Claude.</li>
          <li><span className="text-foreground">2.</span> Sign in with your Archy email when Claude asks.</li>
          <li><span className="text-foreground">3.</span> Come back here and open Claude from this tab.</li>
          <Link href="/install" className="mt-1 flex h-8 items-center justify-center gap-1 rounded-md bg-primary font-medium text-primary-foreground hover:opacity-90">
            Install the connector <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
          </Link>
        </ol>
      )}
    </div>
  );
}
