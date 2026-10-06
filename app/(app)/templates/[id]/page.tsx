import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { catalog, FACT_LABEL, PURPOSE_LABEL } from '@/lib/catalog';

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = (await catalog()).find((i) => i.manifest.id === id);
  if (!item) notFound();
  const { manifest, config, formats, needs, extras } = item;
  const optional = new Set(config.optional ?? []);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link href="/templates" className="text-sm text-muted-foreground hover:text-foreground">← Templates</Link>
        <h1 className="text-3xl font-semibold">{config.title}</h1>
        <p className="max-w-2xl text-muted-foreground">{config.description}</p>
        <div className="flex flex-wrap gap-2 pt-1 text-sm">
          <Badge>{PURPOSE_LABEL[config.purpose ?? ''] ?? config.purpose}</Badge>
          {config.useWhen && <span className="text-muted-foreground">Use when: {config.useWhen}</span>}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        {formats.map((f) => {
          const fm = manifest.formats[f];
          const h = 360;
          return (
            <figure key={f} className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/preview/${manifest.id}/${f}`} alt={fm.label} loading="lazy" className="rounded-md border bg-muted shadow-sm"
                style={{ height: h, width: Math.round((h * fm.width) / fm.height) }} />
              <figcaption className="text-xs text-muted-foreground">{fm.label}</figcaption>
            </figure>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="gap-3 p-5 lg:col-span-1">
          <h2 className="font-heading text-lg font-semibold">What it needs</h2>
          <div className="flex flex-wrap gap-1">{needs.map((n) => <Badge key={n}>{FACT_LABEL[n] ?? n}</Badge>)}</div>
          {extras.length > 0 && (
            <>
              <h3 className="pt-2 text-sm font-medium">Also shows, when available</h3>
              <div className="flex flex-wrap gap-1">{extras.map((n) => <Badge key={n} variant="outline">{FACT_LABEL[n] ?? n}</Badge>)}</div>
            </>
          )}
          <p className="pt-2 text-xs text-muted-foreground">Headlines and short copy are written from the brief.</p>
        </Card>

        <Card className="py-0 lg:col-span-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Slot</TableHead>
                <TableHead>Example</TableHead>
                <TableHead className="pr-4">Room</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(manifest.slots).map(([k, s]) => {
                const lim = s.limits?.[formats.includes('post') ? 'post' : formats[0]];
                return (
                  <TableRow key={k}>
                    <TableCell className="pl-4 align-top">
                      <div className="font-medium">{k}</div>
                      <div className="text-xs text-muted-foreground">{optional.has(k) ? 'Optional' : 'Essential'} · {s.type}</div>
                    </TableCell>
                    <TableCell className="max-w-64 align-top whitespace-normal text-muted-foreground">{s.type === 'text' ? s.default : '—'}</TableCell>
                    <TableCell className="pr-4 align-top text-muted-foreground">
                      {lim ? `${lim.maxCharsPerLine} chars × ${lim.maxLines} line${lim.maxLines > 1 ? 's' : ''}` : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
