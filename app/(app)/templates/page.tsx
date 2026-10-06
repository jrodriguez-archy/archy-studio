import { PageHeader, Pills, Segmented } from '@/components/app-shell';
import { TemplateBrowser, type TemplateCard } from '@/components/template-browser';
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

      <TemplateBrowser sections={sections.map((s) => ({ key: s.key, label: category ? undefined : CATEGORY_LABEL[s.key], items: s.items.map(card) }))} />
    </>
  );
}

function card({ manifest, config, formats, needs, extras }: CatalogItem): TemplateCard {
  const optional = new Set(config.optional ?? []);
  return {
    id: manifest.id, title: config.title, description: config.description, category: config.category ?? '',
    categoryLabel: CATEGORY_LABEL[config.category ?? ''] ?? '', purposeLabel: PURPOSE_LABEL[config.purpose ?? ''] ?? '',
    useWhen: config.useWhen, notWhen: config.notWhen,
    needs: needs.map((n) => FACT_LABEL[n] ?? n), extras: extras.map((n) => FACT_LABEL[n] ?? n),
    formats: formats.map((f) => ({ key: f, label: manifest.formats[f].label, width: manifest.formats[f].width, height: manifest.formats[f].height })),
    slots: Object.entries(manifest.slots).map(([key, s]) => ({ key, type: s.type, optional: optional.has(key) })),
  };
}
