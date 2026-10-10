import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader, Segmented } from '@/components/app-shell';
import { currentBrand } from '@/lib/brand';
import { formatLabel } from '@/lib/gallery-shared';
import { listProposals, STATUS_LABEL, STATUSES, type ProposalStatus } from '@/lib/proposals';
import { currentUser } from '@/lib/team';
import { setProposalStatusAction } from './actions';

export const metadata = { title: 'Template proposals' };
export const dynamic = 'force-dynamic';

const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
// What an admin can do with a proposal in each state.
const NEXT: Record<ProposalStatus, ProposalStatus[]> = { proposed: ['in-progress', 'dismissed'], 'in-progress': ['done', 'proposed'], done: ['in-progress'], dismissed: ['proposed'] };

// Explorations the team proposed as templates: the candidates for the next templates in Paper.
export default async function ProposalsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const me = await currentUser();
  if (!me?.is_admin) redirect('/');
  const raw = (await searchParams).status;
  const status: ProposalStatus = STATUSES.includes(raw as ProposalStatus) ? (raw as ProposalStatus) : 'proposed';
  const items = await listProposals(await currentBrand(), status);
  return (
    <div>
      <PageHeader title="Template proposals" description="Explorations the team proposed as templates.">
        <Segmented items={STATUSES.map((s) => ({ href: s === 'proposed' ? '/admin/proposals' : `/admin/proposals?status=${s}`, label: STATUS_LABEL[s], active: s === status }))} />
      </PageHeader>
      {items.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-4 gap-y-6">
          {items.map((p) => (
            <figure key={p.id} className="text-[13px]">
              <Link href={`/?all=1&set=${p.setId}`} className="block overflow-hidden rounded-lg bg-foreground/[0.04] ring-1 ring-foreground/[0.06]">
                {p.thumb && /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.thumb} alt="" width={p.width} height={p.height} loading="lazy" className="block h-auto w-full" style={{ aspectRatio: `${p.width} / ${p.height}` }} />}
              </Link>
              <figcaption className="mt-1.5 space-y-0.5 px-0.5">
                <div className="truncate font-medium">{p.title}</div>
                <div className="truncate text-foreground/45">{p.formats.map(formatLabel).join(', ')} · {p.by} · {when(p.createdAt)}</div>
                {p.note && <p className="text-foreground/70">{p.note}</p>}
                <div className="flex gap-1.5 pt-1.5">
                  {NEXT[p.status].map((s) => (
                    <form key={s} action={setProposalStatusAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="status" value={s} />
                      <button type="submit" className="h-7 rounded-md bg-foreground/[0.05] px-2.5 text-[12px] text-foreground/80 transition-colors hover:bg-foreground/[0.09]">
                        {s === 'proposed' ? 'Reopen' : s === 'dismissed' ? 'Dismiss' : STATUS_LABEL[s]}
                      </button>
                    </form>
                  ))}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="mx-auto max-w-md py-20 text-center text-[13px]">
          <p className="text-[15px] font-medium">Nothing {STATUS_LABEL[status].toLowerCase()}</p>
          <p className="mt-1.5 text-foreground/55">Explorations proposed from the gallery show here.</p>
        </div>
      )}
    </div>
  );
}
