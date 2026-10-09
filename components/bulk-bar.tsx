'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowTurnBackwardIcon, Cancel01Icon, Delete02Icon } from '@hugeicons/core-free-icons';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { archiveSetsAction, deleteSetsAction, restoreSetsAction } from '@/app/(app)/sets/actions';

type Bulk = { ok: boolean; done: number; failed: number; error?: string };
const plural = (n: number) => `${n} design${n === 1 ? '' : 's'}`;

// Archive's selection bar: restore or delete every picked set at once.
export function BulkBar({ ids, total, onSelectAll, onClear, onDone }: {
  ids: string[]; total: number; onSelectAll: () => void; onClear: () => void; onDone: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [pending, start] = useTransition();
  const n = ids.length;

  const run = (fn: (ids: string[]) => Promise<Bulk>, verb: string, undo?: () => void) =>
    start(async () => {
      const r = await fn(ids);
      if (r.done) onDone();
      if (r.failed) toast.error(`${verb} ${r.done} of ${r.done + r.failed}`, { description: r.error });
      else toast.success(`${verb} ${plural(r.done)}`, undo ? { action: { label: 'Undo', onClick: undo } } : undefined);
    });

  const restore = () => {
    const picked = ids;
    run(restoreSetsAction, 'Restored', () => start(async () => { const r = await archiveSetsAction(picked); if (!r.ok) toast.error(r.error ?? 'Could not undo'); }));
  };

  if (!n) return null;
  return (
    <>
      <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
        <div className="flex items-center gap-1 rounded-xl bg-background/90 p-1.5 pl-3.5 text-[13px] shadow-lg ring-1 ring-foreground/[0.08] backdrop-blur">
          <span className="pr-2 font-medium tabular-nums">{n} selected</span>
          {n < total && <Button variant="ghost" size="lg" onClick={onSelectAll} disabled={pending}>Select all</Button>}
          <Button variant="ghost" size="lg" onClick={restore} disabled={pending}>
            <HugeiconsIcon icon={ArrowTurnBackwardIcon} /> Restore
          </Button>
          <Button variant="destructive" size="lg" onClick={() => setDeleting(true)} disabled={pending}>
            <HugeiconsIcon icon={Delete02Icon} /> Delete…
          </Button>
          <Button variant="ghost" size="icon-lg" onClick={onClear} disabled={pending} aria-label="Clear selection" title="Clear selection (Esc)">
            <HugeiconsIcon icon={Cancel01Icon} />
          </Button>
        </div>
      </div>
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {plural(n)} for good?</AlertDialogTitle>
            <AlertDialogDescription>All their files are deleted from Studio. This can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => run(deleteSetsAction, 'Deleted')}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
