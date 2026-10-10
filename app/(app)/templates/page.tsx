import { PageHeader, Pills, Segmented } from '@/components/app-shell';
import { ExploreHint } from '@/components/explore-hint';
import { EXAMPLE_BRIEFS } from '@/lib/example-briefs';
import { TemplateBrowser, type TemplateCard, type TemplateGroup } from '@/components/template-browser';
import { previewSrcs, selfOrigin } from '@/lib/previews';
import { currentBrand } from '@/lib/brand';
import { BRANDS } from '@/lib/brands';
import { catalog, CATEGORY_LABEL, FACT_LABEL, PURPOSE_LABEL, PURPOSE_PLURAL, TAXONOMY, type CatalogItem } from '@/lib/catalog';

export const metadata = { title: 'Templates' };

// Two levels that never mix: big categories (Events, Ads…) and, inside each, subcategories by what the
// piece is for (Booth invites, Spotlights…). Each style stacks its formats, the event page cover among them.
export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ category?: string; purpose?: string }> }) {
  const { category: rawCategory, purpose } = await searchParams;
  const brand = await currentBrand();
  const all = await catalog(brand);
  const srcs = await previewSrcs(all, await selfOrigin());
  const styles = all;
  const hasCover = (i: CatalogItem) => !!i.manifest.formats.cover;
  const taxonomy = TAXONOMY.filter((c) => c.brand === brand && styles.some((i) => i.config.category === c.key));
  const category = taxonomy.find((c) => c.key === rawCategory);
  const coversOnly = !!category && purpose === 'event-cover';

  const href = (c?: string, p?: string) => {
    const s = new URLSearchParams();
    if (c) s.set('category', c);
    if (p) s.set('purpose', p);
    return s.size ? `/templates?${s}` : '/templates';
  };
  const card = (i: CatalogItem) => toCard(srcs, i, coversOnly ? 'cover' : undefined);

  // Subcategories of a category, in taxonomy order; unknown ones last, so nothing is lost.
  const subcategories = (key: string, items: CatalogItem[]) => {
    const known = TAXONOMY.find((c) => c.brand === brand && c.key === key)?.purposes ?? [];
    const present = [...new Set(items.map((i) => i.config.purpose ?? 'other'))];
    return [...known.filter((p) => present.includes(p)), ...present.filter((p) => !known.includes(p))];
  };
  const groupOf = (c: (typeof TAXONOMY)[number], filter?: string): TemplateGroup => {
    let items = styles.filter((i) => i.config.category === c.key);
    if (filter === 'event-cover') items = items.filter(hasCover);
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
  const hasCovers = !!category && styles.some((i) => i.config.category === category.key && hasCover(i));

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

      {all.length ? (
        <>
          {/* Explorations cover what the catalog does not (Archy only for now). */}
          {brand === 'archy' && <ExploreHint brief={EXAMPLE_BRIEFS.exploration[0]} />}
          <TemplateBrowser groups={groups} showGroupHeaders={!category} />
        </>
      ) : (
        <div className="rounded-xl bg-foreground/[0.03] px-6 py-24 text-center">
          <p className="font-medium">No {BRANDS[brand].name} templates yet</p>
          <p className="mt-1 text-muted-foreground">They appear here once the designers prepare them.</p>
        </div>
      )}
    </>
  );
}

function toCard(srcs: Record<string, string>, { manifest, config, formats, needs, extras }: CatalogItem, lead?: string): TemplateCard {
  const optional = new Set(config.optional ?? []);
  const own = formats.map((f) => ({ key: f, templateId: manifest.id, src: srcs[`${manifest.id}/${f}`], label: manifest.formats[f].label, width: manifest.formats[f].width, height: manifest.formats[f].height }));
  return {
    id: manifest.id, title: config.title, description: config.description, category: config.category ?? '',
    categoryLabel: CATEGORY_LABEL[config.category ?? ''] ?? '', purposeLabel: PURPOSE_LABEL[config.purpose ?? ''] ?? '',
    useWhen: config.useWhen, notWhen: config.notWhen,
    needs: needs.map((n) => FACT_LABEL[n] ?? n), extras: extras.map((n) => FACT_LABEL[n] ?? n),
    formats: own, lead,
    slots: Object.entries(manifest.slots).map(([key, s]) => {
      // Designs that have this slot (a design's files are its default theme's, or the base formats).
      const has = manifest.default && Object.keys(manifest.designs ?? {}).filter((d) => {
        const combo = d === manifest.default!.design ? null : Object.keys(manifest.combos ?? {}).find((c) => c.startsWith(`${d}--`));
        return Object.keys(manifest.formats).some((f) => (combo ? `${f}--${combo}` : f) in (s.perFormat ?? {}));
      });
      return { key, type: s.type, optional: optional.has(key), designs: has && has.length < Object.keys(manifest.designs ?? {}).length ? has : undefined };
    }),
    // The default design and theme first.
    ...(manifest.default ? {
      comboSrcs: Object.fromEntries(Object.entries(srcs).filter(([k]) => k.startsWith(`${manifest.id}/`) && k.includes('--')).map(([k, v]) => [k.slice(manifest.id.length + 1), v])),
      designs: Object.entries(manifest.designs ?? {}).map(([key, d]) => ({ key, label: d.label })).sort((a, b) => Number(b.key === manifest.default!.design) - Number(a.key === manifest.default!.design)),
      themes: Object.entries(manifest.themes ?? {}).map(([key, t]) => ({ key, label: t.label })).sort((a, b) => Number(b.key === manifest.default!.theme) - Number(a.key === manifest.default!.theme)),
    } : {}),
  };
}
