'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { InfoRows, Inspector, StageImage, useInspector } from '@/components/inspector';

export type TemplateCard = {
  id: string; title: string; description: string; category: string; categoryLabel: string; purposeLabel: string;
  useWhen?: string; notWhen?: string; needs: string[]; extras: string[];
  formats: { key: string; label: string; width: number; height: number }[];
  slots: { key: string; type: 'text' | 'image' | 'logo'; optional: boolean }[];
};
export type TemplateSection = { key: string; label?: string; items: TemplateCard[] };

const lead = (t: TemplateCard) => t.formats.find((f) => f.key === 'post') ?? t.formats[0];

// The catalog grid, in sections. A click opens the template in place with its formats and what it needs.
export function TemplateBrowser({ sections }: { sections: TemplateSection[] }) {
  const all = sections.flatMap((s) => s.items);
  const { openId, open, close, step } = useInspector('t', all.map((t) => t.id));
  const current = all.find((t) => t.id === openId);
  const [format, setFormat] = useState<string | null>(null);
  useEffect(() => setFormat(null), [openId]);
  const shown = current ? current.formats.find((f) => f.key === format) ?? lead(current) : null;

  return (
    <>
      <div className="space-y-10">
        {sections.map((s) => (
          <section key={s.key} className="space-y-3">
            {s.label && (
              <h2 className="flex items-baseline gap-2 text-[15px] font-medium">
                {s.label}
                <span className="text-[13px] font-normal text-foreground/40">{s.items.length}</span>
              </h2>
            )}
            <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 2xl:columns-4">
              {s.items.map((t) => {
                const f = lead(t);
                return (
                  <button key={t.id} type="button" onClick={() => open(t.id)} className="group mb-3 block w-full cursor-zoom-in break-inside-avoid text-left">
                    <div className="flex items-center justify-center rounded-lg bg-foreground/[0.04] p-8 ring-1 ring-foreground/[0.06] transition-colors group-hover:bg-foreground/[0.06] sm:p-10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/preview/${t.id}/${f.key}`} alt={`${t.title} ${f.label}`} loading="lazy"
                        className="w-full rounded-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_-12px_rgba(0,0,0,0.25)]" style={{ aspectRatio: `${f.width} / ${f.height}` }} />
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-1.5 px-0.5 text-[13px]">
                      <span className="truncate">{t.title}</span>
                      <span className="ml-auto shrink-0 text-foreground/40">{t.formats.length} format{t.formats.length > 1 ? 's' : ''}</span>
                    </div>
                    <p className="truncate px-0.5 text-[13px] text-foreground/40">{t.purposeLabel}{t.needs.length ? ` · Needs ${t.needs.join(', ').toLowerCase()}` : ''}</p>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {current && shown && (
        <Inspector
          eyebrow={`${current.categoryLabel} · ${current.purposeLabel}`}
          title={current.title}
          onClose={close}
          onStep={step}
          stage={<StageImage src={`/api/preview/${current.id}/${shown.key}`} alt={`${current.title} ${shown.label}`} width={shown.width} height={shown.height} />}
          info={
            <div className="space-y-6">
              {current.description && !current.description.toLowerCase().startsWith(current.purposeLabel.toLowerCase()) && <p className="text-foreground/70">{current.description}</p>}

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
                <InfoRows rows={current.slots.map((s) => [s.key, <span key={s.key} className={s.optional ? 'text-foreground/40' : ''}>{s.type === 'text' ? 'Text' : s.type === 'logo' ? 'Logo' : 'Image'} · {s.optional ? 'Optional' : 'Essential'}</span>])} />
              </section>

              <Link href={`/templates/${current.id}`} className="inline-flex text-foreground/60 underline decoration-foreground/20 underline-offset-4 hover:text-foreground hover:decoration-foreground">
                Examples and length limits
              </Link>
            </div>
          }
        />
      )}
    </>
  );
}

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
