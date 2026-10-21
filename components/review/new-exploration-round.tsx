'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { newExplorationRoundAction } from '@/app/(app)/admin/review/actions';
import { Button } from '@/components/ui/button';
import type { Brand } from '@/lib/brands';

// A round of what the team explored since the last one (this brand), as it is: nothing is drawn again.
export function NewExplorationRound({ brand }: { brand: Brand }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const go = () => start(async () => {
    try {
      const out = await newExplorationRoundAction(brand);
      if (!out.id) { toast('No new explorations since the last round.'); return; }
      toast(`Round ${out.number}: ${out.count} designs.`);
      router.push(`/admin/review?kind=exploration&round=${out.id}`);
    } catch (e) { toast.error((e as Error).message); }
  });
  return (
    <Button size="lg" disabled={busy} onClick={go} title="Newest of each format per set, since the last round">
      {busy ? 'Gathering…' : 'New exploration round'}
    </Button>
  );
}
