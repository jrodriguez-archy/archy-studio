import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/app-shell';
import { previewSrcs } from '@/lib/previews';
import { catalog, FACT_LABEL, PURPOSE_LABEL } from '@/lib/catalog';

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = (await catalog()).find((i) => i.manifest.id === id);
  if (!item) notFound();
  const { manifest, config, formats, needs, extras } = item;
  const optional = new Set(config.optional ?? []);
  const srcs = await previewSrcs([item]);
  const lead = formats.includes('post') ? 'post' : formats[0];

  return (
    <>
      <Link href="/templates" className="mb-3 inline-block text-[13px] text-foreground/40 transition-colors hover:text-foreground">← Templates</Link>
      <PageHeader title={config.title} description={PURPOSE_LABEL[config.purpose ?? ''] ?? ''} />

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:flex-wrap lg:overflow-visible">
        {formats.map((f) => {
          const fm = manifest.formats[f];
          return (
            <figure key={f} className="shrink-0">
              <div className="flex h-[20rem] items-center rounded-lg bg-foreground/[0.04] p-6 ring-1 ring-foreground/[0.06] xl:h-[24rem]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={srcs[`${manifest.id}/${f}`]} alt={fm.label} loading="lazy"
                  className="h-full w-auto rounded-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_-12px_rgba(0,0,0,0.25)]" style={{ aspectRatio: `${fm.width} / ${fm.height}` }} />
              </div>
              <figcaption className="mt-1.5 px-0.5 text-[13px] text-foreground/40">{fm.label}</figcaption>
            </figure>
          );
        })}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
        <section className="space-y-5 text-[13px]">
          {config.description && config.description !== PURPOSE_LABEL[config.purpose ?? ''] && !config.description.startsWith(PURPOSE_LABEL[config.purpose ?? ''] ?? '\u0000') && (
            <p className="text-foreground/70">{config.description}</p>
          )}
          {config.useWhen && (
            <div>
              <p className="text-foreground/40">Use when</p>
              <p className="mt-0.5">{config.useWhen}</p>
            </div>
          )}
          <div>
            <p className="text-foreground/40">Needs</p>
            <p className="mt-0.5">{needs.map((n) => FACT_LABEL[n] ?? n).join(', ')}</p>
          </div>
          {extras.length > 0 && (
            <div>
              <p className="text-foreground/40">Also shows, when available</p>
              <p className="mt-0.5">{extras.map((n) => FACT_LABEL[n] ?? n).join(', ')}</p>
            </div>
          )}
          <p className="text-foreground/40">Headlines and short copy are written from the brief.</p>
        </section>

        <section className="text-[13px]">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] gap-x-6 border-b border-foreground/[0.06] pb-2 text-foreground/40">
            <span>Slot</span><span>Example</span><span className="text-right">Room</span>
          </div>
          {Object.entries(manifest.slots).map(([k, s]) => {
            const lim = s.limits?.[lead];
            return (
              <div key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] gap-x-6 border-b border-foreground/[0.06] py-2.5">
                <span className="min-w-0">
                  <span className="block truncate">{k}</span>
                  <span className="text-foreground/40">{optional.has(k) ? 'Optional' : 'Essential'}</span>
                </span>
                <span className="min-w-0 break-words text-foreground/60">{s.type === 'text' ? s.default : s.type === 'logo' ? 'Link to a logo' : 'Link to an image'}</span>
                <span className="text-right whitespace-nowrap text-foreground/60">{lim ? `${lim.maxCharsPerLine} × ${lim.maxLines}` : '—'}</span>
              </div>
            );
          })}
          <p className="mt-2 text-foreground/40">Room: characters per line × lines at full size; text can shrink a little to fit more.</p>
        </section>
      </div>
    </>
  );
}
