import { PageHeader, Pills, Segmented } from '@/components/app-shell';
import { TemplateBrowser, type TemplateCard, type TemplateGroup } from '@/components/template-browser';
import { catalog, CATEGORY_LABEL, FACT_LABEL, PURPOSE_LABEL, PURPOSE_PLURAL, TAXONOMY, type CatalogItem } from '@/lib/catalog';

export const metadata = { title: 'Templates · Archy Studio' };

// Two levels that never mix: big categories (Events, Ads…) and, inside each, subcategories by what the
// piece is for (Booth invites, Spotlights…). Each style stacks its formats; an event page cover joins its
// style as one more format.
export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ category?: string; purpose?: string }> }) {
  const { category: rawCategory, purpose } = await searchParams;
  const all = await catalog();
  const byId = Object.fromEntries(all.map((i) => [i.manifest.id, i]));
  const styles = all.filter((i) => !i.config.coverOf);
  const taxonomy = TAXONOMY.filter((c) => styles.some((i) => i.config.category === c.key));
  const category = taxonomy.find((c) => c.key === rawCategory);
  const coversOnly = !!category && purpose === 'event-cover';

  const href = (c?: string, p?: string) => {
    const s = new URLSearchParams();
    if (c) s.set('category', c);
    if (p) s.set('purpose', p);
    return s.size ? `/templates?${s}` : '/templates';
  };
  const card = (i: CatalogItem) => toCard(i, i.config.cover ? byId[i.config.cover] : undefined, coversOnly ? 'cover' : undefined);

  // Subcategories of a category, in taxonomy order; unknown ones last, so nothing is lost.
  const subcategories = (key: string, items: CatalogItem[]) => {
    const known = TAXONOMY.find((c) => c.key === key)?.purposes ?? [];
    const present = [...new Set(items.map((i) => i.config.purpose ?? 'other'))];
    return [...known.filter((p) => present.includes(p)), ...present.filter((p) => !known.includes(p))];
  };
  const groupOf = (c: (typeof TAXONOMY)[number], filter?: string): TemplateGroup => {
    let items = styles.filter((i) => i.config.category === c.key);
    if (filter === 'event-cover') items = items.filter((i) => i.config.cover);
    else if (filter) items = items.filter((i) => i.config.purpose === filter);
    return {
      key: c.key, label: c.label, description: c.description, href: href(c.key), count: items.length,
      sections: subcategories(c.key, items).map((p) => ({
        key: p, label: PURPOSE_PLURAL[p] ?? PURPOSE_LABEL[p] ?? p,
        items: items.filter((i) => (i.config.purpose ?? 'other') === p).map(card),
      })),
    };
  };
  const groups = category ? [groupOf(category, purpose)] : taxonomy.map((c) => groupOf(c));

  const purposes = category ? subcategories(category.key, styles.filter((i) => i.config.category === category.key)) : [];
  const hasCovers = !!category && styles.some((i) => i.config.category === category.key && i.config.cover);

  return (
    <>
      <PageHeader
        title={category ? category.label : 'Templates'}
        description={category ? category.description : 'The approved designs Claude builds from. Each style comes in several formats.'}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Segmented
            items={[
              { href: href(), label: 'All', active: !category },
              ...taxonomy.map((c) => ({ href: href(c.key), label: c.label, active: category?.key === c.key })),
            ]}
          />
          {category && (purposes.length > 1 || hasCovers) && (
            <>
              <span className="hidden h-5 w-px bg-foreground/10 sm:block" aria-hidden />
              <Pills
                items={[
                  { href: href(category.key), label: `All ${category.label.toLowerCase()}`, active: !purpose },
                  ...purposes.map((p) => ({ href: href(category.key, p), label: PURPOSE_PLURAL[p] ?? PURPOSE_LABEL[p] ?? p, active: purpose === p })),
                  ...(hasCovers ? [{ href: href(category.key, 'event-cover'), label: 'Event page covers', active: purpose === 'event-cover' }] : []),
                ]}
              />
            </>
          )}
        </div>
      </PageHeader>

      <TemplateBrowser groups={groups} showGroupHeaders={!category} />
    </>
  );
}

function toCard({ manifest, config, formats, needs, extras }: CatalogItem, cover?: CatalogItem, lead?: string): TemplateCard {
  const optional = new Set(config.optional ?? []);
  const own = formats.map((f) => ({ key: f, templateId: manifest.id, label: manifest.formats[f].label, width: manifest.formats[f].width, height: manifest.formats[f].height }));
  const extra = cover ? cover.formats.map((f) => ({ key: f, templateId: cover.manifest.id, label: cover.manifest.formats[f].label, width: cover.manifest.formats[f].width, height: cover.manifest.formats[f].height })) : [];
  return {
    id: manifest.id, title: config.title, description: config.description, category: config.category ?? '',
    categoryLabel: CATEGORY_LABEL[config.category ?? ''] ?? '', purposeLabel: PURPOSE_LABEL[config.purpose ?? ''] ?? '',
    useWhen: config.useWhen, notWhen: config.notWhen,
    needs: needs.map((n) => FACT_LABEL[n] ?? n), extras: extras.map((n) => FACT_LABEL[n] ?? n),
    formats: [...own, ...extra], lead, coverId: cover?.manifest.id,
    slots: Object.entries(manifest.slots).map(([key, s]) => ({ key, type: s.type, optional: optional.has(key) })),
  };
}
