import Link from 'next/link';
import { PageHeader, Pills } from '@/components/app-shell';
import { catalog, FACT_LABEL, PURPOSE_LABEL } from '@/lib/catalog';

export const metadata = { title: 'Templates · Archy Studio' };

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ purpose?: string }> }) {
  const { purpose } = await searchParams;
  const all = await catalog();
  const items = purpose ? all.filter((i) => i.config.purpose === purpose) : all;

  return (
    <>
      <PageHeader title="Templates" description="The approved designs Claude builds from.">
        <Pills
          items={[
            { href: '/templates', label: 'All', active: !purpose },
            ...Object.entries(PURPOSE_LABEL).map(([k, label]) => ({ href: `/templates?purpose=${k}`, label, active: purpose === k })),
          ]}
        />
      </PageHeader>

      <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 2xl:columns-4">
        {items.map(({ manifest, config, formats, needs }) => {
          const lead = formats.includes('post') ? 'post' : formats[0];
          const f = manifest.formats[lead];
          return (
            <Link key={manifest.id} href={`/templates/${manifest.id}`} className="group mb-3 block break-inside-avoid">
              <div className="flex items-center justify-center rounded-lg bg-foreground/[0.04] p-8 ring-1 ring-foreground/[0.06] transition-colors group-hover:bg-foreground/[0.06] sm:p-10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/preview/${manifest.id}/${lead}`} alt={`${config.title} ${f.label}`} loading="lazy"
                  className="w-full rounded-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_-12px_rgba(0,0,0,0.25)]" style={{ aspectRatio: `${f.width} / ${f.height}` }} />
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5 px-0.5 text-[13px]">
                <span className="truncate">{config.title}</span>
                <span className="ml-auto shrink-0 text-foreground/40">{formats.length} format{formats.length > 1 ? 's' : ''}</span>
              </div>
              <p className="truncate px-0.5 text-[13px] text-foreground/40">Needs {needs.map((n) => (FACT_LABEL[n] ?? n).toLowerCase()).join(', ')}</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
