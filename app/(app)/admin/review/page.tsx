import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/app-shell';
import { ReviewBoard } from '@/components/review/review-board';
import { listRounds, loadRound } from '@/lib/review';
import { currentUser } from '@/lib/team';

export const metadata = { title: 'Template review · Archy Studio' };
export const dynamic = 'force-dynamic';

// Template review: every template × format × case of a round, to approve or comment on. Claude makes the
// rounds and works through the comments.
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  const me = await currentUser();
  if (!me?.is_admin) redirect('/');
  const rounds = await listRounds();
  const { round: wanted } = await searchParams;
  const round = rounds.find((r) => r.id === wanted) ?? rounds[0];
  const items = round ? await loadRound(round.id) : [];
  return (
    <div>
      <PageHeader title="Template review" description="Every template with example copy, in each format. Approve it or click on the image to say what to improve; Claude works through the comments and the next round shows before and after." />
      {round ? <ReviewBoard key={round.id} rounds={rounds} round={round} items={items} /> : (
        <p className="py-16 text-center text-[13px] text-foreground/50">No rounds yet. Ask Claude to make the first one.</p>
      )}
    </div>
  );
}
