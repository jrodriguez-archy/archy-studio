import Link from 'next/link';
import { PageHeader, Segmented } from '@/components/app-shell';
import { formatLabel, groupSets, loadPieces } from '@/lib/gallery';
import { currentUser } from '@/lib/team';

export const metadata = { title: 'Canvas · Archy Studio' };
export const dynamic = 'force-dynamic';

const day = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Canvas home: pick a piece to correct by hand. Every format of every set is its own card (the newest
// of each), recently edited first.
export default async function CanvasHome({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const me = (await currentUser())!;
  const mine = !all;
  const sets = groupSets(await loadPieces({ userId: mine ? me.id : undefined }, 120));
  const pieces = sets.flatMap((s) => s.pieces.map((p) => ({ ...p, setTitle: s.title })));
  const edited = pieces.filter((p) => p.edited_at).sort((a, b) => b.edited_at!.localeCompare(a.edited_at!));
  const rest = pieces.filter((p) => !p.edited_at);

  return (
    <>
      <PageHeader title="Canvas" description="Open a piece to fix copy, colours, images or sizes by hand, then download it or save it to the gallery.">
        <Segmented items={[{ href: '/canvas', label: 'Mine', active: mine }, { href: '/canvas?all=1', label: 'Team', active: !mine }]} />
      </PageHeader>

      {pieces.length === 0 ? (
        <div className="rounded-xl bg-foreground/[0.03] px-6 py-24 text-center">
          <p className="font-medium">No pieces to edit yet</p>
          <p className="mt-1 text-muted-foreground">Ask Claude for a piece with the Archy Studio plugin, then open it here. <Link href="/install" className="text-foreground underline underline-offset-4">Install it</Link></p>
        </div>
      ) : (
        <div className="space-y-10">
          {edited.length > 0 && <Shelf title="Recently edited" pieces={edited} edited />}
          <Shelf title={edited.length ? 'All pieces' : undefined} pieces={rest} />
        </div>
      )}
    </>
  );
}

type Card = Awaited<ReturnType<typeof loadPieces>>[number] & { setTitle: string };

function Shelf({ title, pieces, edited }: { title?: string; pieces: Card[]; edited?: boolean }) {
  if (!pieces.length) return null;
  return (
    <section>
      {title && <p className="pb-3 text-[13px] text-foreground/40">{title}</p>}
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {pieces.map((p) => (
          <Link key={p.id} href={`/canvas/${p.id}`} className="group block text-[13px]">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-foreground/[0.04] p-4 ring-1 ring-foreground/[0.06] transition-colors group-hover:bg-[#E6F4FF] group-hover:ring-primary/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumb} alt="" loading="lazy" className="max-h-full max-w-full rounded-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.08)]" style={{ aspectRatio: `${p.width} / ${p.height}` }} />
            </div>
            <div className="mt-1.5 truncate px-0.5">{p.setTitle}</div>
            <div className="truncate px-0.5 text-foreground/40">
              {formatLabel(p.format)} · {p.author} · <span suppressHydrationWarning>{day(edited ? p.edited_at! : p.created_at)}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
