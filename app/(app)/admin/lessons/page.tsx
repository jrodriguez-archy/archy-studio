import { redirect } from 'next/navigation';
import { PageHeader, Segmented } from '@/components/app-shell';
import { currentBrand } from '@/lib/brand';
import { LESSON_LABEL, LESSON_STATUSES, listLessons, type LessonStatus } from '@/lib/lessons';
import { currentUser } from '@/lib/team';
import { saveLessonAction } from './actions';

export const metadata = { title: 'Lessons' };
export const dynamic = 'force-dynamic';

// What each state can become, besides saving the words.
const NEXT: Record<LessonStatus, LessonStatus[]> = { proposed: ['approved', 'retired'], approved: ['retired'], retired: ['approved'] };
const VERB: Record<LessonStatus, string> = { proposed: 'Reopen', approved: 'Approve', retired: 'Retire' };
const field = 'w-full rounded-md bg-foreground/[0.04] px-2.5 py-1.5 outline-none ring-1 ring-foreground/[0.06] focus:ring-foreground/20';

// Lessons from review: approved ones go out with the brand kit to every exploration.
export default async function LessonsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const me = await currentUser();
  if (!me?.is_admin) redirect('/');
  const raw = (await searchParams).status;
  const status: LessonStatus = LESSON_STATUSES.includes(raw as LessonStatus) ? (raw as LessonStatus) : 'proposed';
  const items = await listLessons(await currentBrand(), status);
  return (
    <div>
      <PageHeader title="Lessons" description="Approved lessons guide every exploration.">
        <Segmented items={LESSON_STATUSES.map((s) => ({ href: s === 'proposed' ? '/admin/lessons' : `/admin/lessons?status=${s}`, label: LESSON_LABEL[s], active: s === status }))} />
      </PageHeader>
      {items.length ? (
        <div className="mx-auto max-w-3xl space-y-8">
          {items.map((l) => (
            <form key={l.id} action={saveLessonAction} className="space-y-2.5 text-[13px]">
              <input type="hidden" name="id" value={l.id} />
              {l.examples.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {l.examples.flatMap((e, i) => [e.before, e.after].map((src, j) => src && (
                    <figure key={`${i}-${j}`} className="w-40 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" width={e.width} height={e.height} loading="lazy" className="block h-auto w-full rounded-md ring-1 ring-foreground/[0.06]" style={{ aspectRatio: `${e.width} / ${e.height}` }} />
                      <figcaption className="mt-1 text-[11px] text-foreground/45">{j ? 'After' : 'Before'}</figcaption>
                    </figure>
                  )))}
                </div>
              )}
              <input name="title" defaultValue={l.title} className={`${field} font-medium`} />
              <input name="applies_when" defaultValue={l.appliesWhen ?? ''} placeholder="Applies when…" className={`${field} text-foreground/70`} />
              <textarea name="body" defaultValue={l.body} rows={4} className={`${field} leading-relaxed`} />
              <div className="flex items-center gap-1.5">
                <button type="submit" className="h-7 rounded-md bg-foreground/[0.05] px-2.5 text-[12px] text-foreground/80 hover:bg-foreground/[0.09]">Save</button>
                {NEXT[l.status].map((s) => (
                  <button key={s} type="submit" name="status" value={s} className={`h-7 rounded-md px-2.5 text-[12px] ${s === 'approved' ? 'bg-foreground text-background hover:bg-foreground/85' : 'bg-foreground/[0.05] text-foreground/80 hover:bg-foreground/[0.09]'}`}>{VERB[s]}</button>
                ))}
                {l.source && <span className="ml-auto truncate text-[11px] text-foreground/40">{l.source}</span>}
              </div>
            </form>
          ))}
        </div>
      ) : (
        <div className="mx-auto max-w-md py-20 text-center text-[13px]">
          <p className="text-[15px] font-medium">No {LESSON_LABEL[status].toLowerCase()} lessons</p>
        </div>
      )}
    </div>
  );
}
