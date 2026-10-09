import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/app-shell';
import { previewSrcs } from '@/lib/previews';
import { catalog, FACT_LABEL, PURPOSE_LABEL } from '@/lib/catalog';
import { comboFormats, resolveCombo } from '@/lib/templates';

export default async function TemplatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ design?: string; theme?: string }> }) {
  const { id } = await params;
  const item = (await catalog()).find((i) => i.manifest.id === id);
  if (!item) notFound();
  const { manifest, config, formats, needs, extras } = item;
  const optional = new Set(config.optional ?? []);
  const srcs = await previewSrcs([item]);
  const lead = formats.includes('post') ? 'post' : formats[0];
  // Templates with several designs and themes: the one chosen (?design=&theme=), else the default.
  const q = await searchParams;
  let combo = null;
  try { combo = resolveCombo(manifest, q.design, q.theme); } catch { combo = resolveCombo(manifest); }
  const files = comboFormats(manifest, combo);
  const keyOf = (f: string) => (combo?.key ? `${f}--${combo.key}` : f);
  const comboQuery = (d: string, t: string) => `?design=${d}&theme=${t}`;
  const inCombo = (k: string) => !manifest.slots[k].perFormat || Object.keys(files).some((f) => keyOf(f) in manifest.slots[k].perFormat!);

  return (
    <>
      <Link href="/templates" className="mb-3 inline-block text-[13px] text-foreground/40 transition-colors hover:text-foreground">← Templates</Link>
      <PageHeader title={config.title} description={PURPOSE_LABEL[config.purpose ?? ''] ?? ''} />

      {combo && (
        <section className="mb-8">
          <p className="pb-2 text-[13px] text-foreground/40">Designs and themes · {manifest.designs![combo.design].label}, {manifest.themes![combo.theme].label}</p>
          <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
            <div className="grid w-max grid-cols-[auto_repeat(3,7.5rem)] items-center gap-2 text-[13px]">
              <span />
              {Object.entries(manifest.themes!).map(([t, th]) => <span key={t} className="text-foreground/40">{th.label}</span>)}
              {Object.entries(manifest.designs!).map(([d, de]) => (
                <div key={d} className="contents">
                  <span className="pr-3 text-foreground/60">{de.label}</span>
                  {Object.keys(manifest.themes!).map((t) => {
                    const on = d === combo!.design && t === combo!.theme;
                    return (
                      <Link key={t} href={comboQuery(d, t)} scroll={false} title={`${de.label} · ${manifest.themes![t].label}`}
                        className={`block rounded-[4px] p-1 ring-1 transition-colors ${on ? 'bg-[#E6F4FF] ring-primary/50' : 'ring-foreground/[0.06] hover:ring-primary/30'}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={srcs[`${manifest.id}/${d === manifest.default!.design && t === manifest.default!.theme ? lead : `${lead}--${d}--${t}`}`]} alt="" loading="lazy" className="aspect-square w-full rounded-[2px] object-cover" />
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:flex-wrap lg:overflow-visible">
        {formats.filter((f) => files[f]).map((f) => {
          const fm = files[f];
          return (
            <figure key={f} className="shrink-0">
              <div className="flex h-[20rem] items-center rounded-lg bg-foreground/[0.04] p-6 ring-1 ring-foreground/[0.06] xl:h-[24rem]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={srcs[`${manifest.id}/${combo?.key ? `${f}--${combo.key}` : f}`]} alt={fm.label} loading="lazy"
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
          {Object.entries(manifest.slots).filter(([k]) => inCombo(k)).map(([k, s]) => {
            const lim = s.limits?.[keyOf(lead)];
            return (
              <div key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] gap-x-6 border-b border-foreground/[0.06] py-2.5">
                <span className="min-w-0">
                  <span className="block truncate">{k}</span>
                  <span className="text-foreground/40">{optional.has(k) ? 'Optional' : 'Essential'}</span>
                </span>
                <span className="min-w-0 break-words text-foreground/60">{s.type === 'text' ? s.default : s.type === 'logo' ? 'Link to a logo' : 'Link to an image'}</span>
                <span className="text-right whitespace-nowrap text-foreground/60">{lim ? `${lim.maxCharsPerLine} × ${k === 'headline' ? 'room' : lim.maxLines}` : '—'}</span>
              </div>
            );
          })}
          <p className="mt-2 text-foreground/40">Room: characters per line × lines at full size; text can shrink a little to fit more.</p>
        </section>
      </div>
    </>
  );
}
