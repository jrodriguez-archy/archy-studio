import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { currentBrand } from '@/lib/brand';
import { listMissing } from '@/lib/missing-templates';
import { currentUser } from '@/lib/team';

export const metadata = { title: 'Missing templates' };
export const dynamic = 'force-dynamic';

const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Briefs no template fit, as Claude kept them: the most asked-for kind of piece first.
export default async function MissingPage() {
  const me = await currentUser();
  if (!me?.is_admin) redirect('/');
  const brand = await currentBrand();
  const groups = (await listMissing()).filter((g) => g.brand === brand);
  return (
    <div className="max-w-5xl">
      <PageHeader title="Missing templates" description="What people asked Claude for that no template covers." />
      {groups.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Piece</TableHead>
              <TableHead className="w-20 text-right">Asked</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Offered instead</TableHead>
              <TableHead>By</TableHead>
              <TableHead className="w-20 text-right">Last</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => (
              <TableRow key={g.key} className="align-top">
                <TableCell className="whitespace-normal">
                  <p className="font-medium">{g.piece}</p>
                  {g.reasons.map((r) => <p key={r} className="text-foreground/55">{r}</p>)}
                  {g.facts.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{g.facts.map((f) => <Badge key={f} variant="secondary">{f}</Badge>)}</div>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{g.count}</TableCell>
                <TableCell className="whitespace-normal text-foreground/70">{g.formats.join(', ') || '–'}</TableCell>
                <TableCell className="whitespace-normal text-foreground/70">{g.offered.join(', ') || '–'}</TableCell>
                <TableCell className="whitespace-normal text-foreground/70">{g.who.join(', ') || '–'}</TableCell>
                <TableCell className="text-right text-foreground/70">{when(g.last)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="mx-auto max-w-md py-20 text-center text-[13px]">
          <p className="text-[15px] font-medium">Nothing missing yet</p>
          <p className="mt-1.5 text-foreground/55">Briefs no template fits show here.</p>
        </div>
      )}
    </div>
  );
}
