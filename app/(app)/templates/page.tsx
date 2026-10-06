import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { catalog, FACT_LABEL, PURPOSE_LABEL } from '@/lib/catalog';

export const metadata = { title: 'Templates · Archy Studio' };

export default async function TemplatesPage() {
  const items = await catalog();
  const groups = Object.entries(PURPOSE_LABEL).map(([key, label]) => ({ label, items: items.filter((i) => i.config.purpose === key) })).filter((g) => g.items.length);
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-semibold">Templates</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          The approved designs Claude builds from. It picks the one that fits your brief: what each template needs is listed on its card.
        </p>
      </div>
      {groups.map((g) => (
        <section key={g.label} className="space-y-4">
          <h2 className="text-xl font-semibold">{g.label}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map(({ manifest, config, formats, needs }) => {
              const lead = formats.includes('post') ? 'post' : formats[0];
              const f = manifest.formats[lead];
              return (
                <Link key={manifest.id} href={`/templates/${manifest.id}`} className="group">
                  <Card className="h-full gap-3 overflow-hidden py-0 transition-shadow group-hover:shadow-md">
                    <div className="flex items-center justify-center bg-muted p-4" style={{ aspectRatio: '4 / 3' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/preview/${manifest.id}/${lead}`} alt={`${config.title} ${f.label}`} loading="lazy"
                        className="max-h-full max-w-full rounded-sm object-contain shadow-sm" style={{ aspectRatio: `${f.width} / ${f.height}` }} />
                    </div>
                    <CardContent className="space-y-2 px-4 pb-4">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-heading text-base font-semibold">{config.title}</h3>
                        <span className="text-xs text-muted-foreground">{formats.length} format{formats.length > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {needs.map((n) => <Badge key={n} variant="secondary" className="font-normal">{FACT_LABEL[n] ?? n}</Badge>)}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
