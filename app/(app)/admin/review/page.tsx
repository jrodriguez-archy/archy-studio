import { redirect } from 'next/navigation';
import { PageHeader, Pills } from '@/components/app-shell';
import { NewExplorationRound } from '@/components/review/new-exploration-round';
import { ReviewBoard } from '@/components/review/review-board';
import { currentBrand } from '@/lib/brand';
import { listRounds, loadRound, type ReviewKind } from '@/lib/review';
import { currentUser } from '@/lib/team';

export const metadata = { title: 'Review' };
export const dynamic = 'force-dynamic';

// Review: template rounds (every template × format × case, made by Claude) and exploration rounds (the
// team's explorations as they are). Approve, or comment on a spot; Claude works through the comments.
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ round?: string; kind?: string }> }) {
  const me = await currentUser();
  if (!me?.is_admin) redirect('/');
  const { round: wanted, kind: k } = await searchParams;
  const kind: ReviewKind = k === 'exploration' ? 'exploration' : 'template';
  const rounds = await listRounds(kind);
  const round = rounds.find((r) => r.id === wanted) ?? rounds[0];
  const items = round ? await loadRound(round) : [];
  const brand = await currentBrand();
  const explore = kind === 'exploration';
  return (
    <div>
      <PageHeader title="Review" description={explore ? 'The team’s explorations. Approve, or click a design to comment.' : 'New templates, in every format. Approve, or click a design to comment.'}
        aside={explore ? <NewExplorationRound brand={brand} /> : undefined}>
        <Pills items={[{ href: '/admin/review', label: 'Templates', active: !explore }, { href: '/admin/review?kind=exploration', label: 'Explorations', active: explore }]} />
      </PageHeader>
      {round ? <ReviewBoard key={round.id} rounds={rounds} round={round} items={items} /> : (
        <div className="mx-auto max-w-md py-20 text-center text-[13px]">
          <p className="text-[15px] font-medium">{explore ? 'No exploration round yet' : 'No template in review'}</p>
          <p className="mt-1.5 text-foreground/55">{explore ? 'Start one with New exploration round.' : 'Ask Claude: “review the template booth-icon-list”.'}</p>
        </div>
      )}
    </div>
  );
}
