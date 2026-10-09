import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/app-shell';
import { ReviewBoard } from '@/components/review/review-board';
import { listRounds, loadRound } from '@/lib/review';
import { currentUser } from '@/lib/team';

export const metadata = { title: 'Template review' };
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
      <PageHeader title="Template review" description="New templates with example content, in each format. Approve them or click on a design to say what to improve; Claude works through the comments and the next round shows before and after." />
      {round ? <ReviewBoard key={round.id} rounds={rounds} round={round} items={items} /> : (
        <div className="mx-auto max-w-md py-20 text-center text-[13px]">
          <p className="text-[15px] font-medium">No template in review</p>
          <p className="mt-1.5 text-foreground/55">When a new template is ready in Paper, ask Claude to review it (“review the template booth-icon-list”). It shows here with example content in every format: approve it or click on the design to say what to improve.</p>
        </div>
      )}
    </div>
  );
}
