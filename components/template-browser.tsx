'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { Copy01Icon, Link01Icon, SparklesIcon, ViewIcon } from '@hugeicons/core-free-icons';
import { ContextActions, MoreActions, copy, type Action } from '@/components/action-menu';
import { InfoRows, Inspector, StageImage, useInspector } from '@/components/inspector';
import { StackBadge, StackLayers, stackPad } from '@/components/stack';

export type TemplateCard = {
  id: string; title: string; description: string; category: string; categoryLabel: string; purposeLabel: string;
  useWhen?: string; notWhen?: string; needs: string[]; extras: string[];
  /** Every format of the style, the event page cover (1200×900) among them on event templates. */
  formats: { key: string; templateId: string; src: string; label: string; width: number; height: number }[];
  /** Format shown in front (e.g. the cover when filtering by event page covers). */
  lead?: string;
  /** `designs`: the designs that have the slot, when only some do. */
  slots: { key: string; type: 'text' | 'image' | 'logo'; optional: boolean; designs?: string[] }[];
  /** Designs (layouts) and themes (colour treatments), on templates that offer several; the first is the default. */
  designs?: { key: string; label: string }[];
  themes?: { key: string; label: string }[];
  /** Preview links of the other designs and themes, keyed `<format>--<design>--<theme>`. */
  comboSrcs?: Record<string, string>;
};
type Combo = { design: string; theme: string } | null;
export type TemplateSection = { key: string; label?: string; items: TemplateCard[] };
/** A big category (Events, Ads…) with its subcategories. */
export type TemplateGroup = { key: string; label: string; description?: string; href?: string; count: number; sections: TemplateSection[] };

// What someone pastes in Claude to make a piece with this exact template (and design and theme).
function templatePrompt(t: TemplateCard, combo: Combo = null) {
  const pick = combo && t.designs ? `, design ${combo.design} (${labelOf(t.designs, combo.design)}), theme ${combo.theme} (${labelOf(t.themes!, combo.theme)})` : '';
  return [
    `Use the Archy Studio template ${t.id} (${t.title})${pick}${t.formats.some((f) => f.key === 'cover') ? ' (and its event page cover format if useful)' : ''} for this brief:`,
    ...t.needs.map((n) => `- ${n}: `),
    ...t.extras.map((n) => `- ${n} (optional): `),
  ].join('\n');
}

const copied = (what: string) => async (text: string) => { (await copy(text)) ? toast.success(`${what} copied`) : toast.error('Could not copy'); };

function templateActions(t: TemplateCard, onOpen: () => void): Action[] {
  return [
    { label: 'Open', icon: ViewIcon, onSelect: onOpen },
    { separator: true },
    { label: 'Copy template ID', icon: Copy01Icon, hint: t.id, onSelect: () => copied('Template ID')(t.id) },
    { label: 'Copy prompt for Claude', icon: SparklesIcon, onSelect: () => copied('Prompt')(templatePrompt(t)) },
    { label: 'Copy link', icon: Link01Icon, onSelect: () => copied('Link')(`${location.origin}/templates?t=${t.id}`) },
  ];
}

// The event page covers used to be templates of their own; their old ids still open their style.
const OLD_COVERS: Record<string, string> = {
  'event-cover-booth': 'booth-icon-list', 'event-cover-booth-light': 'booth-light-rulers', 'event-cover-booth-photo': 'booth-invite-photo',
  'event-cover-booth-photo-band': 'booth-photo-band', 'event-cover-night-out': 'night-out-illustration',
  'event-cover-night-out-venue': 'night-out-venue', 'event-cover-speaker': 'speaker-invite',
};

const lead = (t: TemplateCard) => t.formats.find((f) => f.key === (t.lead ?? 'post')) ?? t.formats[0];
const labelOf = (list: { key: string; label: string }[], key: string) => list.find((x) => x.key === key)?.label ?? key;
// A design × theme applies to every format of the template; the default one is the format's own preview.
const preview = (f: { src: string; key: string }, combo: Combo = null, own = true, t?: TemplateCard) =>
  (combo && own && t?.comboSrcs?.[`${f.key}--${combo.design}--${combo.theme}`]) || f.src;
const defaultCombo = (t: TemplateCard): Combo => (t.designs?.length && t.themes?.length ? { design: t.designs[0].key, theme: t.themes[0].key } : null);

// The catalog grid, in sections. A click opens the template in place with its formats and what it needs.
export function TemplateBrowser({ groups, showGroupHeaders }: { groups: TemplateGroup[]; showGroupHeaders: boolean }) {
  const all = groups.flatMap((g) => g.sections.flatMap((s) => s.items));
  const { openId, open, close, step } = useInspector('t', all.map((t) => t.id));
  // An old link to a cover template (?t=event-cover-booth) opens its style with the cover in front.
  const search = useSearchParams();
  const requested = search.get('t');
  const viaCover = !openId && requested && OLD_COVERS[requested] ? all.find((t) => t.id === OLD_COVERS[requested]) : undefined;
  const current = all.find((t) => t.id === openId) ?? viaCover;
  const [format, setFormat] = useState<string | null>(null);
  const [combo, setCombo] = useState<Combo>(null);
  useEffect(() => { setFormat(null); setCombo(null); }, [openId, viaCover?.id]);
  const pick = current ? combo ?? defaultCombo(current) : null;
  const stepAny = (d: 1 | -1) => {
    if (!viaCover) return step(d);
    const i = all.indexOf(viaCover);
    window.history.replaceState(null, '', `${location.pathname}?t=${all[(i + d + all.length) % all.length].id}`);
  };
  const shown = current ? current.formats.find((f) => f.key === (format ?? (viaCover ? 'cover' : null))) ?? lead(current) : null;
  // The open template's other formats, designs and themes load in the background, so switching is instant.
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => {
      for (const src of new Set([...current.formats.map((f) => f.src), ...Object.values(current.comboSrcs ?? {})])) new Image().src = src;
    }, 300);
    return () => clearTimeout(t);
  }, [current]);

  return (
    <>
      <div className="space-y-16">
        {groups.map((g) => (
          <div key={g.key} className="space-y-6">
            {showGroupHeaders && (
              <header className="flex items-end justify-between gap-4 border-b border-foreground/[0.07] pb-3">
                <div className="min-w-0">
                  <h2 className="flex items-baseline gap-2 text-[20px] font-medium tracking-[-0.01em]">
                    {g.label}
                    <span className="text-[13px] font-normal text-foreground/40">{g.count} {g.count === 1 ? 'style' : 'styles'}</span>
                  </h2>
                  {g.description && <p className="mt-0.5 text-[13px] text-foreground/50">{g.description}</p>}
                </div>
                {g.href && <Link href={g.href} className="shrink-0 text-[13px] text-foreground/50 transition-colors hover:text-foreground">View all →</Link>}
              </header>
            )}
            <div className="space-y-8">
              {g.sections.map((s) => (
              <section key={s.key} className="space-y-3">
                {s.label && (
                  <h3 className="flex items-baseline gap-1.5 text-[13px] text-foreground/50">
                    {s.label}
                    <span className="text-foreground/30">{s.items.length}</span>
                  </h3>
                )}
                <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 2xl:columns-4">
                  {s.items.map((t) => {
                    const f = lead(t);
                    return (
                      <ContextActions key={t.id} actions={templateActions(t, () => open(t.id))} className={`group relative mb-3 block break-inside-avoid ${stackPad(t.formats.length)}`}>
                      <button type="button" onClick={() => open(t.id)} className="block w-full cursor-zoom-in text-left">
                        <div className="relative">
                        <StackLayers n={t.formats.length} />
                        <div className="relative flex items-center justify-center rounded-lg bg-[#F4F4F4] p-8 ring-1 ring-foreground/[0.06] transition-colors group-hover:bg-[#EFEFEF] sm:p-10">
                          <StackBadge n={t.formats.length} />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={preview(f)} alt={`${t.title} ${f.label}`} loading="lazy"
                            className="w-full rounded-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_-12px_rgba(0,0,0,0.25)]" style={{ aspectRatio: `${f.width} / ${f.height}` }} />
                        </div>
                        </div>
                        <div className="mt-1.5 flex items-baseline gap-1.5 px-0.5 text-[13px]">
                          <span className="truncate">{t.title}</span>
                          <span className="ml-auto shrink-0 text-foreground/40">{t.formats.map((x) => (x.key === 'og' ? 'OG' : x.key[0].toUpperCase() + x.key.slice(1))).join(' · ')}</span>
                        </div>
                        <p className="truncate px-0.5 text-[13px] text-foreground/40">{t.purposeLabel}{t.designs ? ` · ${t.designs.length} designs, ${t.themes!.length} themes` : ''}{t.needs.length ? ` · Needs ${t.needs.join(', ').toLowerCase()}` : ''}</p>
                      </button>
                      <MoreActions actions={templateActions(t, () => open(t.id))} className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity outline-none group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 max-lg:opacity-100" />
                      </ContextActions>
                    );
                  })}
                </div>
              </section>
              ))}
            </div>
          </div>
        ))}
      </div>

      {current && shown && (
        <Inspector
          eyebrow={`${current.categoryLabel} · ${current.purposeLabel}`}
          title={current.title}
          onClose={close}
          onStep={stepAny}
          stage={<StageImage src={preview(shown, pick, shown.templateId === current.id, current)} placeholder={shown.src} alt={`${current.title} ${shown.label}`} width={shown.width} height={shown.height} />}
          info={
            <div className="space-y-6">
              {current.description && !current.description.toLowerCase().startsWith(current.purposeLabel.toLowerCase()) && <p className="text-foreground/70">{current.description}</p>}

              {pick && current.designs && current.themes && (
                <>
                  <Chips label="Design" items={current.designs} active={pick.design} onPick={(design) => setCombo({ ...pick, design })} />
                  <Chips label="Theme" items={current.themes} active={pick.theme} onPick={(theme) => setCombo({ ...pick, theme })} />
                </>
              )}

              <section>
                <p className="pb-1.5 text-foreground/40">Formats</p>
                <div className="flex flex-wrap gap-1.5">
                  {current.formats.map((f) => (
                    <button key={f.key} type="button" onClick={() => setFormat(f.key)}
                      className={`flex h-7 items-center rounded-[4px] px-2.5 text-[13px] transition-colors ${
                        f.key === shown.key ? 'bg-[#E6F4FF] font-medium text-primary' : 'bg-foreground/[0.04] text-foreground/60 hover:bg-foreground/[0.07] hover:text-foreground'
                      }`}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </section>

              <InfoRows
                rows={[
                  ['ID', <IdButton key="id" id={current.id} />],
                  ['Cover', current.formats.some((f) => f.key === 'cover') && 'Event page cover format (1200×900, Webflow)'],
                  ['Category', current.categoryLabel],
                  ['Purpose', current.purposeLabel],
                  ['Needs', current.needs.join(', ')],
                  ['Also shows', current.extras.join(', ')],
                  ['Use when', current.useWhen && sentence(current.useWhen)],
                  ['Not when', current.notWhen && sentence(current.notWhen)],
                ]}
              />

              <section>
                <p className="pb-1.5 text-foreground/40">Slots</p>
                <InfoRows rows={current.slots.filter((s) => !s.designs || !pick || s.designs.includes(pick.design)).map((s) => [s.key, <span key={s.key} className={s.optional ? 'text-foreground/40' : ''}>{s.type === 'text' ? 'Text' : s.type === 'logo' ? 'Logo' : 'Image'} · {s.optional ? 'Optional' : 'Essential'}</span>])} />
              </section>

              <button type="button" onClick={() => copied('Prompt')(templatePrompt(current, pick))} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90">
                <HugeiconsIcon icon={SparklesIcon} className="size-3.5" /> Copy prompt for Claude
              </button>

              <Link href={`/canvas/new?template=${current.id}&format=${shown.templateId === current.id ? shown.key : lead(current).key}${pick ? `&design=${pick.design}&theme=${pick.theme}` : ''}`}
                className="flex h-8 w-full items-center justify-center rounded-md bg-foreground/[0.05] px-3 text-[13px] font-medium transition-colors hover:bg-foreground/[0.08]">
                Start in Canvas
              </Link>

              <Link href={`/templates/${current.id}${pick ? `?design=${pick.design}&theme=${pick.theme}` : ''}`} className="inline-flex text-foreground/60 underline decoration-foreground/20 underline-offset-4 hover:text-foreground hover:decoration-foreground">
                Examples and length limits
              </Link>
            </div>
          }
        />
      )}
    </>
  );
}

function IdButton({ id }: { id: string }) {
  return (
    <button type="button" onClick={() => copied('Template ID')(id)} title="Copy template ID" className="inline-flex items-center gap-1.5 font-mono text-[12px] hover:text-primary">
      {id}<HugeiconsIcon icon={Copy01Icon} className="size-3 text-foreground/40" />
    </button>
  );
}

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// A row of choices (designs, themes) in the template inspector, styled like the format tabs.
function Chips({ label, items, active, onPick }: { label: string; items: { key: string; label: string }[]; active: string; onPick: (key: string) => void }) {
  return (
    <section>
      <p className="pb-1.5 text-foreground/40">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((x) => (
          <button key={x.key} type="button" onClick={() => onPick(x.key)}
            className={`flex h-7 items-center rounded-[4px] px-2.5 text-[13px] transition-colors ${
              x.key === active ? 'bg-[#E6F4FF] font-medium text-primary' : 'bg-foreground/[0.04] text-foreground/60 hover:bg-foreground/[0.07] hover:text-foreground'
            }`}>
            {x.label}
          </button>
        ))}
      </div>
    </section>
  );
}
