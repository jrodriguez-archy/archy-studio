'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, ArrowRight01Icon, Layers01Icon, LockIcon, ViewIcon, ViewOffSlashIcon } from '@hugeicons/core-free-icons';
import type { Edits, Preset } from '@/lib/canvas-shared';
import { humanize } from '@/lib/gallery-shared';
import type { Comp } from './model';
import { PRESETS, type SlotMeta } from './properties-panel';

// Content: the design as someone who is not a designer reads it. What it says (the copy from the brief),
// its images, its look (the theme) and, folded away, its decorations. A click picks the part on the
// design and opens its controls on the right. Every layer is still there under Advanced.
export function ContentPanel({ comps, edits, slots, slotMeta, previews, preset, selected, hover, onSelect, onHover, onSlotToggle, onSlot, onHide, onPreset, onAdvanced }: {
  comps: Comp[]; edits: Edits; slots: Record<string, string | null>; slotMeta: Record<string, SlotMeta>; previews: Record<string, string | null>;
  preset?: Preset; selected: string[]; hover: string | null;
  onSelect: (id: string) => void; onHover: (id: string | null) => void;
  /** Leave an optional detail out (the design closes up), or bring it back. */
  onSlotToggle: (slot: string) => void;
  /** An image for a detail that is not on the design yet (a partner logo). */
  onSlot: (slot: string, value: string) => void;
  onHide: (id: string) => void; onPreset: (p: Preset) => void; onAdvanced: () => void;
}) {
  const [decorOpen, setDecorOpen] = useState(false);
  const texts = comps.filter((c) => (c.kind === 'text' && c.slot) || (c.kind === 'button' && c.textSlot));
  const images = comps.filter((c) => (c.kind === 'photo' || c.kind === 'partner') && c.slot);
  const archy = comps.find((c) => c.kind === 'archy');
  // Optional details this design leaves out right now: listed too, so they can come back.
  const drawn = new Set(comps.flatMap((c) => [c.slot, c.textSlot]).filter(Boolean));
  // (Only once the design is read: while it loads, nothing is drawn yet.)
  const absent = comps.length ? Object.entries(slotMeta).filter(([k, m]) => m.optional && !drawn.has(k)) : [];
  const absentTexts = absent.filter(([, m]) => m.type === 'text').map(([k]) => k);
  const absentImages = absent.filter(([, m]) => m.type !== 'text').map(([k, m]) => [k, m.type] as const);
  const decor = comps.filter((c) => ['decoration', 'line', 'icon'].includes(c.kind) || (c.kind === 'text' && !c.slot) || (c.kind === 'photo' && !c.slot));

  const rowClass = (id: string) => `group mx-1.5 flex min-h-8 cursor-default items-center gap-2 rounded-md px-2 py-1 text-[12px] ${
    selected.includes(id) ? 'bg-[#E6F4FF]' : hover === id ? 'bg-foreground/[0.04]' : 'hover:bg-foreground/[0.04]'}`;
  const pick = (id: string) => ({ onClick: () => onSelect(id), onMouseEnter: () => onHover(id), onMouseLeave: () => onHover(null) });

  // An optional detail has an eye (left out: the design closes up); an essential one cannot go.
  const slotEye = (slot: string, empty: boolean) => slotMeta[slot]?.optional ? (
    <button type="button" onClick={(e) => { e.stopPropagation(); onSlotToggle(slot); }} aria-label={empty ? 'Bring it back' : 'Leave it out'} title={empty ? 'Bring it back' : 'Leave it out (the design closes up)'}
      className={`flex size-5 shrink-0 items-center justify-center rounded text-foreground/40 hover:text-foreground ${empty ? '' : 'opacity-0 group-hover:opacity-100'}`}>
      <HugeiconsIcon icon={empty ? ViewOffSlashIcon : ViewIcon} className="size-3.5" strokeWidth={1.6} />
    </button>
  ) : <span className="size-5 shrink-0" title="Essential to the design" />;

  return (
    <div className="space-y-4 py-2">
      <Group title="Text">
        {texts.map((c) => {
          const slot = (c.slot ?? c.textSlot)!;
          const value = slots[slot];
          return (
            <div key={c.id} {...pick(c.id)} className={rowClass(c.id)}>
              <div className={`min-w-0 flex-1 ${value ? '' : 'opacity-45'}`}>
                <p className="truncate text-foreground/50">{c.kind === 'button' ? 'Button' : c.name}</p>
                <p className="truncate text-[13px] text-foreground">{value ? value.replace(/\n/g, ' ') : 'Left out'}</p>
              </div>
              {slotEye(slot, !value)}
            </div>
          );
        })}
        {absentTexts.map((k) => (
          <div key={k} className={rowClass(`slot:${k}`)} onClick={() => onSlotToggle(k)}>
            <div className="min-w-0 flex-1 opacity-45">
              <p className="truncate text-foreground/50">{nameOf(k)}</p>
              <p className="truncate text-[13px]">Left out</p>
            </div>
            {slotEye(k, true)}
          </div>
        ))}
      </Group>

      {(images.length > 0 || archy || absentImages.length > 0) && (
        <Group title="Images">
          {images.map((c) => {
            const value = slots[c.slot!];
            const src = previews[c.slot!];
            return (
              <div key={c.id} {...pick(c.id)} className={rowClass(c.id)}>
                <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-[repeating-conic-gradient(#f2f2f2_0_25%,#fff_0_50%)] bg-[length:8px_8px] ring-1 ring-foreground/[0.06]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {value && src && <img src={src} alt="" className={`size-full ${c.kind === 'partner' ? 'object-contain p-0.5' : 'object-cover'}`} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate ${value ? '' : 'opacity-45'}`}>{c.name}</p>
                  <p className="text-foreground/40">{value ? 'Replace' : 'Left out'}</p>
                </div>
                {slotEye(c.slot!, !value)}
              </div>
            );
          })}
          {absentImages.map(([k, type]) => <AddImage key={k} name={nameOf(k)} logo={type === 'logo'} className={rowClass(`slot:${k}`)} onPick={(v) => onSlot(k, v)} />)}
          {archy && (
            <div {...pick(archy.id)} className={rowClass(archy.id)}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[4px] bg-foreground/[0.04]">
                <HugeiconsIcon icon={LockIcon} className="size-3.5 text-foreground/40" strokeWidth={1.6} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate">Archy logo</p>
                <p className="text-foreground/40">Move and scale only</p>
              </div>
            </div>
          )}
        </Group>
      )}

      <Group title="Look">
        <div className="grid grid-cols-5 gap-1 px-3">
          {PRESETS.map(([key, label, swatch]) => (
            <button key={key} type="button" onClick={() => onPreset(key)} title={label}
              className={`flex flex-col items-center gap-1 rounded-md p-1 ring-1 transition-colors ${preset === key ? 'bg-[#E6F4FF] ring-primary/50' : 'ring-foreground/10 hover:bg-foreground/[0.03]'}`}>
              <span className="flex h-6 w-full items-center justify-center rounded-[4px] text-[10px] font-semibold" style={swatch}>Aa</span>
              <span className={`text-[10px] ${preset === key ? 'font-medium text-primary' : 'text-foreground/60'}`}>{label}</span>
            </button>
          ))}
        </div>
      </Group>

      {decor.length > 0 && (
        <div>
          <button type="button" onClick={() => setDecorOpen((o) => !o)} className="flex h-7 w-full items-center gap-1 px-3 text-left hover:bg-foreground/[0.03]">
            <HugeiconsIcon icon={decorOpen ? ArrowDown01Icon : ArrowRight01Icon} className="size-3 text-foreground/40" strokeWidth={2} />
            <span className="text-[11px] font-medium tracking-[0.02em] text-foreground/45">Decorations</span>
            <span className="text-[11px] text-foreground/30">{decor.length}</span>
          </button>
          {decorOpen && decor.map((c) => {
            const hidden = !!edits[c.id]?.hidden;
            return (
              <div key={c.id} {...pick(c.id)} className={rowClass(c.id)}>
                <span className={`min-w-0 flex-1 truncate ${hidden ? 'opacity-40' : 'text-foreground/75'}`}>{c.name}</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); onHide(c.id); }} aria-label={hidden ? 'Show' : 'Hide'}
                  className={`flex size-5 shrink-0 items-center justify-center rounded text-foreground/40 hover:text-foreground ${hidden ? '' : 'opacity-0 group-hover:opacity-100'}`}>
                  <HugeiconsIcon icon={hidden ? ViewOffSlashIcon : ViewIcon} className="size-3.5" strokeWidth={1.6} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t border-foreground/[0.06] px-1.5 pt-2">
        <button type="button" onClick={onAdvanced} className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[12px] text-foreground/55 hover:bg-foreground/[0.04] hover:text-foreground">
          <HugeiconsIcon icon={Layers01Icon} className="size-3.5" strokeWidth={1.6} />
          <span className="flex-1">Advanced: all layers</span>
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="px-3 pb-1 text-[11px] font-medium tracking-[0.02em] text-foreground/45">{title}</p>
      {children}
    </div>
  );
}

const nameOf = (slot: string) => (slot === 'logo-partner' ? 'Partner logo' : slot === 'logo-offer' ? 'Offer logo' : humanize(slot.replace(/^image-/, '') + (slot.startsWith('image-') ? ' photo' : '')));

// An optional image the design does not show yet: upload it and it takes its place.
function AddImage({ name, logo, className, onPick }: { name: string; logo: boolean; className: string; onPick: (v: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const body = new FormData();
      body.set('file', file);
      const res = await fetch('/api/uploads', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not upload the image.');
      onPick(data.value);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div className={className} onClick={() => !busy && input.current?.click()}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[4px] border border-dashed border-foreground/20 text-[14px] text-foreground/40">+</span>
      <div className="min-w-0 flex-1">
        <p className="truncate opacity-60">{name}</p>
        <p className="text-primary">{busy ? 'Uploading…' : logo ? 'Add a logo' : 'Add a photo'}</p>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
    </div>
  );
}
