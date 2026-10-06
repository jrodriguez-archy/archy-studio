import Link from 'next/link';
import { PageHeader, Pills, Segmented } from '@/components/app-shell';
import { PieceGrid } from '@/components/piece-grid';
import { TYPES, loadPieces } from '@/lib/gallery';
import { listProjects } from '@/lib/projects';
import { currentUser } from '@/lib/team';

export const metadata = { title: 'Gallery · Archy Studio' };
export const dynamic = 'force-dynamic';

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ all?: string; type?: string }> }) {
  const { all, type } = await searchParams;
  const me = (await currentUser())!;
  const mine = !all; // default: the signed-in person's own pieces
  const kind = TYPES.find((t) => t.key === type);
  const [pieces, projects] = await Promise.all([
    loadPieces({ userId: mine ? me.id : undefined, formats: kind?.formats }),
    listProjects(me).catch(() => []),
  ]);

  const href = (p: { all?: boolean; type?: string }) => {
    const s = new URLSearchParams();
    if (p.all) s.set('all', '1');
    if (p.type) s.set('type', p.type);
    return s.size ? `/?${s}` : '/';
  };

  return (
    <>
      <PageHeader title="Gallery" description={mine ? 'The pieces you made with Studio.' : 'Every piece the team made with Studio.'}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Segmented
            items={[
              { href: href({ type }), label: 'Mine', active: mine },
              { href: href({ all: true, type }), label: 'Team', active: !mine },
            ]}
          />
          <span className="hidden h-5 w-px bg-foreground/10 sm:block" aria-hidden />
          <Pills
            items={[
              { href: href({ all: !mine }), label: 'All types', active: !kind },
              ...TYPES.map((t) => ({ href: href({ all: !mine, type: t.key }), label: t.label, active: kind?.key === t.key })),
            ]}
          />
        </div>
      </PageHeader>

      {pieces.length === 0 ? (
        <div className="rounded-xl bg-foreground/[0.03] px-6 py-24 text-center">
          <p className="font-medium">{mine ? 'You have no pieces yet' : 'Nothing here yet'}</p>
          <p className="mt-1 text-muted-foreground">Ask Claude for a piece with the Archy Studio plugin. <Link href="/install" className="text-foreground underline underline-offset-4">Install it</Link></p>
        </div>
      ) : (
        <PieceGrid pieces={pieces} projects={projects} me={me} />
      )}
    </>
  );
}
