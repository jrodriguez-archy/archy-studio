import Link from 'next/link';
import { PageHeader, Pills, Segmented } from '@/components/app-shell';
import { catalog, CATEGORY_LABEL, FACT_LABEL, PURPOSE_LABEL, type CatalogItem } from '@/lib/catalog';

export const metadata = { title: 'Templates · Archy Studio' };

// Two levels: the category (where the template comes from: Events, Ads...) and, inside it, what the
// piece is for (booth invite, reminder...).
export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ category?: string; purpose?: string }> }) {
  const { category: rawCategory, purpose } = await searchParams;
  const all = await catalog();
  const category = rawCategory && CATEGORY_LABEL[rawCategory] ? rawCategory : undefined;
  const inCategory = category ? all.filter((i) => i.config.category === category) : all;
  const purposes = [...new Set(inCategory.map((i) => i.config.purpose).filter((p): p is string => !!p))];
  const items = purpose ? inCategory.filter((i) => i.config.purpose === purpose) : inCategory;
  const href = (c?: string, p?: string) => {
    const s = new URLSearchParams();
    if (c) s.set('category', c);
    if (p) s.set('purpose', p);
    return s.size ? `/templates?${s}` : '/templates';
  };
  const count = (c: string) => all.filter((i) => i.config.category === c).length;
  // "All" shows the catalog in sections, one per category.
  const sections = category ? [{ key: category, items }] : Object.keys(CATEGORY_LABEL).map((c) => ({ key: c, items: all.filter((i) => i.config.category === c) })).filter((s) => s.items.length);

  return (
    <>
      <PageHeader title="Templates" description="The approved designs Claude builds from.">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Segmented
            items={[
              { href: href(), label: 'All', active: !category },
              ...Object.keys(CATEGORY_LABEL).filter(count).map((c) => ({ href: href(c), label: CATEGORY_LABEL[c], active: category === c })),
            ]}
          />
          {category && purposes.length > 1 && (
            <>
              <span className="hidden h-5 w-px bg-foreground/10 sm:block" aria-hidden />
              <Pills
                items={[
                  { href: href(category), label: `All ${CATEGORY_LABEL[category].toLowerCase()}`, active: !purpose },
                  ...purposes.map((p) => ({ href: href(category, p), label: PURPOSE_LABEL[p] ?? p, active: purpose === p })),
                ]}
              />
            </>
          )}
        </div>
      </PageHeader>

      <div className="space-y-10">
        {sections.map((s) => (
          <section key={s.key} className="space-y-3">
            {!category && (
              <h2 className="flex items-baseline gap-2 text-[15px] font-medium">
                {CATEGORY_LABEL[s.key]}
                <span className="text-[13px] font-normal text-foreground/40">{s.items.length}</span>
              </h2>
            )}
            <Grid items={s.items} />
          </section>
        ))}
      </div>
    </>
  );
}

function Grid({ items }: { items: CatalogItem[] }) {
  return (
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
            <p className="truncate px-0.5 text-[13px] text-foreground/40">{PURPOSE_LABEL[config.purpose ?? ''] ?? ''}{needs.length ? ` · Needs ${needs.map((n) => (FACT_LABEL[n] ?? n).toLowerCase()).join(', ')}` : ''}</p>
          </Link>
        );
      })}
    </div>
  );
}
