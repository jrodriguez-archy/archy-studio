'use client';

import { useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  AlignBottomIcon, AlignHorizontalCenterIcon, AlignLeftIcon, AlignRightIcon, AlignTopIcon, AlignVerticalCenterIcon,
  ArrowTurnBackwardIcon, Cancel01Icon, Delete02Icon, ImageUploadIcon, LockIcon, Tick02Icon, ViewIcon, ViewOffSlashIcon,
} from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Edits, NodeEdit, Preset } from '@/lib/canvas-shared';
import { IconPicker } from './icon-picker';
import type { Comp, LayerInfo, Token } from './model';

export type SlotMeta = { type: 'text' | 'image' | 'logo'; optional: boolean; fontSize?: { min: number; max: number } };
export type LibraryItem = { id: string; title: string; kind: string; url: string };
export type Align = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

const WEIGHTS = [[400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold']] as const;
const KIND_LABEL: Record<Comp['kind'], string> = {
  text: 'Text', button: 'Button', icon: 'Icon', photo: 'Photo', partner: 'Logo', archy: 'Archy logo', group: 'Group',
  tag: 'Tag', line: 'Line', decoration: 'Decoration', background: 'Background',
};

type Props = {
  comp: Comp;
  /** Where Align puts it ("Content", "the safe area"…). */
  alignIn?: string;
  preset?: Preset;
  onPreset: (p: Preset) => void;
  info: (id?: string) => LayerInfo | null;
  edits: Edits;
  slots: Record<string, string | null>;
  slotMeta: Record<string, SlotMeta>;
  previews: Record<string, string | null>;
  tokens: Token[];
  library: LibraryItem[];
  onEdit: (id: string, e: NodeEdit, commit?: boolean) => void;
  onSlot: (name: string, value: string | null) => void;
  onReset: () => void;
  onAlign: (a: Align) => void;
};

// Right column: what the selected component lets you change, inside the brand (palette colours, the
// template's weights, sizes within the slot's limits).
export function PropertiesPanel({ comp, alignIn, preset, onPreset, info, edits, slots, slotMeta, previews, tokens, library, onEdit, onSlot, onReset, onAlign }: Props) {
  const edit = edits[comp.id];
  const box = edit?.box ?? {};
  const me = info(comp.id);
  const edited = [comp.id, comp.textId, comp.iconId].some((id) => id && edits[id] && Object.keys(edits[id]).length);
  const slot = comp.slot ? { value: slots[comp.slot] ?? null, meta: slotMeta[comp.slot], preview: previews[comp.slot] ?? null } : null;
  const movable = comp.kind !== 'background';

  if (comp.kind === 'archy') {
    return (
      <Panel comp={comp} onReset={edited ? onReset : undefined}>
        <div className="flex gap-2.5 rounded-md bg-foreground/[0.04] p-3 text-foreground/60">
          <HugeiconsIcon icon={LockIcon} className="mt-px size-4 shrink-0 text-foreground/50" strokeWidth={1.6} />
          <p>The drawing and its colour are the brand’s. You can move it and scale it; it turns white or Archy blue with the theme.</p>
        </div>
        <Section title="Position">
          <AlignRow alignIn={alignIn} onAlign={onAlign} />
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="X" value={box.dx ?? 0} onChange={(v, c) => onEdit(comp.id, { box: { dx: v } }, c)} />
            <NumberField label="Y" value={box.dy ?? 0} onChange={(v, c) => onEdit(comp.id, { box: { dy: v } }, c)} />
          </div>
          <Row label="Scale">
            <SliderField value={Math.round((box.scale ?? 1) * 100)} min={30} max={300} suffix="%" onChange={(v, commit) => onEdit(comp.id, { box: { scale: v / 100 } }, commit)} />
          </Row>
        </Section>
      </Panel>
    );
  }

  return (
    <Panel comp={comp} onReset={edited ? onReset : undefined}>
      {comp.kind === 'text' && me && (
        <TextControls id={comp.id} info={me} edit={edit} tokens={tokens} slot={slot}
          onText={(t) => (comp.slot ? onSlot(comp.slot, t) : onEdit(comp.id, { text: t }))} onEdit={(e, c) => onEdit(comp.id, e, c)} />
      )}

      {comp.kind === 'button' && (
        <>
          {comp.textId && (
            <Section title="Label">
              <TextField
                value={comp.textSlot ? slots[comp.textSlot] ?? '' : edits[comp.textId]?.text ?? info(comp.textId)?.text ?? ''}
                onCommit={(t) => (comp.textSlot ? onSlot(comp.textSlot, t) : onEdit(comp.textId!, { text: t }))}
                optional={comp.textSlot ? slotMeta[comp.textSlot]?.optional : false}
              />
              <Row label="Text"><ColorField tokens={tokens} current={info(comp.textId)?.color ?? ''} onPick={(v) => onEdit(comp.textId!, { style: { color: v } })} /></Row>
            </Section>
          )}
          <Section title="Button">
            <Row label="Fill"><ColorField tokens={tokens} current={me?.backgroundColor ?? ''} onPick={(v) => onEdit(comp.id, { style: { backgroundColor: v } })} /></Row>
          </Section>
          {comp.iconId && (
            <Section title="Icon">
              <IconPicker current={edits[comp.iconId]?.icon} onPick={(name) => onEdit(comp.iconId!, { icon: name })} />
              <Row label="Colour"><ColorField tokens={tokens} current={info(comp.iconId)?.color ?? ''} onPick={(v) => onEdit(comp.iconId!, { style: { color: v } })} /></Row>
              <Toggle hidden={!!edits[comp.iconId]?.hidden} label="icon" onToggle={() => onEdit(comp.iconId!, { hidden: !edits[comp.iconId!]?.hidden })} />
            </Section>
          )}
        </>
      )}

      {comp.kind === 'icon' && (
        <Section title="Icon">
          <IconPicker current={edit?.icon} onPick={(name) => onEdit(comp.id, { icon: name })} />
          <Row label="Colour"><ColorField tokens={tokens} current={me?.color ?? ''} onPick={(v) => onEdit(comp.id, { style: { color: v } })} /></Row>
        </Section>
      )}

      {(comp.kind === 'photo' || comp.kind === 'partner') && (
        <Section title={comp.kind === 'partner' ? 'Logo' : 'Photo'}>
          <ImagePicker kind={comp.kind} preview={slot?.preview ?? null} library={comp.kind === 'partner' ? [] : library}
            onPick={(v) => (comp.slot ? onSlot(comp.slot, v) : onEdit(comp.id, { image: v }))} />
          {slot?.meta?.optional && slot.value && (
            <button type="button" onClick={() => onSlot(comp.slot!, null)} className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md text-foreground/60 hover:bg-foreground/[0.05] hover:text-foreground">
              <HugeiconsIcon icon={Delete02Icon} className="size-3.5" /> Remove {comp.kind === 'partner' ? 'logo' : 'photo'}
            </button>
          )}
          {comp.kind === 'photo' && (
            <Row label="Zoom">
              <SliderField value={Math.round((box.scale ?? 1) * 100)} min={50} max={250} suffix="%" onChange={(v, commit) => onEdit(comp.id, { box: { scale: v / 100 } }, commit)} />
            </Row>
          )}
        </Section>
      )}

      {comp.kind === 'background' && (
        <Section title="Theme">
          <div className="grid grid-cols-3 gap-1.5">
            {PRESETS.map(([key, label, swatch]) => (
              <button key={key} type="button" onClick={() => onPreset(key)}
                className={`flex flex-col items-center gap-1.5 rounded-md p-2 ring-1 transition-colors ${preset === key ? 'bg-[#E6F4FF] ring-primary/50' : 'ring-foreground/10 hover:bg-foreground/[0.03]'}`}>
                <span className="flex h-8 w-full items-center justify-center rounded-[4px] text-[11px] font-semibold" style={swatch}>Aa</span>
                <span className={preset === key ? 'font-medium text-primary' : 'text-foreground/70'}>{label}</span>
              </button>
            ))}
          </div>
          <p className="text-foreground/40">Texts, buttons, lines, icons and the Archy logo follow the theme.</p>
        </Section>
      )}

      {(comp.kind === 'tag' || comp.kind === 'line' || comp.kind === 'background') && (
        <Section title={comp.kind === 'background' ? 'Fill' : 'Colour'}>
          <ColorField tokens={tokens} current={me?.backgroundColor ?? ''} onPick={(v) => onEdit(comp.id, { style: { backgroundColor: v } })} />
          {comp.kind === 'background' && edit?.style?.backgroundColor && (
            <button type="button" onClick={() => onEdit(comp.id, { style: { backgroundColor: undefined } })} className="text-[12px] text-foreground/50 underline-offset-4 hover:text-foreground hover:underline">
              Back to the original background
            </button>
          )}
        </Section>
      )}

      {me?.layout && (comp.kind === 'group' || comp.kind === 'tag' || comp.kind === 'button') && (
        <LayoutControls layout={me.layout} onEdit={(l, c) => onEdit(comp.id, { layout: l }, c)} />
      )}

      {movable && me && (
        <Section title="Position">
          <AlignRow alignIn={alignIn} onAlign={onAlign} />
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="X" value={box.dx ?? 0} onChange={(v, c) => onEdit(comp.id, { box: { dx: v } }, c)} />
            <NumberField label="Y" value={box.dy ?? 0} onChange={(v, c) => onEdit(comp.id, { box: { dy: v } }, c)} />
            {comp.kind !== 'decoration' && (
              <>
                <NumberField label="W" value={box.width ?? me.width} min={4} onChange={(v, c) => onEdit(comp.id, { box: { width: v } }, c)} />
                <NumberField label="H" value={box.height ?? me.height} min={4} onChange={(v, c) => onEdit(comp.id, { box: { height: v } }, c)} />
              </>
            )}
          </div>
          <Row label="Opacity">
            <SliderField value={Math.round((edit?.style?.opacity ?? me.opacity) * 100)} min={0} max={100} suffix="%" onChange={(v, commit) => onEdit(comp.id, { style: { opacity: v / 100 } }, commit)} />
          </Row>
          <Toggle hidden={!!edit?.hidden} label={KIND_LABEL[comp.kind].toLowerCase()} onToggle={() => onEdit(comp.id, { hidden: !edit?.hidden })} />
        </Section>
      )}
    </Panel>
  );
}

const PRESETS: [Preset, string, React.CSSProperties][] = [
  ['dark', 'Dark', { background: 'linear-gradient(180deg, #000484, #00004E 55%)', color: '#fff' }],
  ['blue', 'Blue', { background: '#013DF5', color: '#fff' }],
  ['light', 'Light', { background: '#fff', color: '#00004E', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }],
];

const ALIGNS = [['left', AlignLeftIcon], ['center', AlignHorizontalCenterIcon], ['right', AlignRightIcon], ['top', AlignTopIcon], ['middle', AlignVerticalCenterIcon], ['bottom', AlignBottomIcon]] as const;

// Align inside the container (without its padding) or the safe area, never against the artboard edge.
function AlignRow({ alignIn, onAlign, label = 'in' }: { alignIn?: string; onAlign: (a: Align) => void; label?: string }) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-6 gap-0.5 rounded-[5px] bg-foreground/[0.05] p-0.5">
        {ALIGNS.map(([a, icon]) => (
          <button key={a} type="button" title={`Align ${a}${alignIn ? ` ${label} ${alignIn}` : ''}`} aria-label={`Align ${a}`} onClick={() => onAlign(a)}
            className="flex h-6 items-center justify-center rounded-[4px] text-foreground/60 hover:bg-background hover:text-foreground hover:shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
            <HugeiconsIcon icon={icon} className="size-3.5" strokeWidth={1.6} />
          </button>
        ))}
      </div>
      {alignIn && <p className="text-[11px] text-foreground/40">Aligns {label} {alignIn}.</p>}
    </div>
  );
}

// Several components selected: move them with the arrows or by dragging, align them to each other or
// to their container, hide them.
export function MultiPanel({ count, onAlign, onHide, onReset }: { count: number; onAlign: (a: Align, to: 'selection' | 'container') => void; onHide: () => void; onReset: () => void }) {
  return (
    <div className="space-y-5 px-4 py-4 text-[12px]">
      <div>
        <p className="text-[13px] font-medium">{count} selected</p>
        <p className="text-foreground/40">Drag to move them together. ⌘-click to add or remove one.</p>
      </div>
      <Section title="Align to each other"><AlignRow onAlign={(a) => onAlign(a, 'selection')} /></Section>
      <Section title="Align in their container"><AlignRow onAlign={(a) => onAlign(a, 'container')} /></Section>
      <Section title="Selection">
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" onClick={onHide} className="flex h-7 items-center justify-center gap-1.5 rounded-md bg-foreground/[0.05] text-foreground/70 hover:bg-foreground/[0.09]">
            <HugeiconsIcon icon={ViewOffSlashIcon} className="size-3.5" /> Hide
          </button>
          <button type="button" onClick={onReset} className="flex h-7 items-center justify-center gap-1.5 rounded-md bg-foreground/[0.05] text-foreground/70 hover:bg-foreground/[0.09]">
            <HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-3.5" /> Reset
          </button>
        </div>
      </Section>
    </div>
  );
}

// No selection: the colours the piece is drawn with. Swapping one changes it everywhere (texts, fills,
// lines, icons, the background), except in the Archy logo.
export function ColorsPanel({ used, tokens, theme, onSwap, onClear }: {
  used: string[]; tokens: Token[]; theme: Record<string, string>; onSwap: (from: string, to: string | null) => void; onClear: () => void;
}) {
  const byHex = new Map(tokens.map((t) => [t.hex, t]));
  return (
    <div className="space-y-5 px-4 py-4 text-[12px]">
      <div>
        <p className="text-[13px] font-medium">Colours</p>
        <p className="text-foreground/50">Swap one and it changes everywhere.</p>
      </div>
      <div className="grid grid-cols-3 gap-x-2 gap-y-3">
        {used.map((hex) => {
          const from = byHex.get(hex);
          const to = theme[hex] ? tokens.find((t) => t.value === theme[hex]) : null;
          return (
            <div key={hex} className="relative">
              <Popover>
                <PopoverTrigger className="group block w-full text-left">
                  <span className="relative block aspect-[4/3] overflow-hidden rounded-md ring-1 ring-foreground/10 ring-inset transition-shadow group-hover:ring-primary/40"
                    style={{ background: to ? `linear-gradient(135deg, ${hex} 50%, ${to.hex} 50%)` : hex }} />
                  <span className="mt-1 block truncate">{to ? to.name : from?.name ?? hex}</span>
                  <span className="block truncate text-[11px] text-foreground/40">{to ? `was ${from?.name ?? hex}` : hex}</span>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[248px] p-3">
                  <p className="pb-2.5 text-[12px]">Replace <span className="font-medium">{from?.name ?? hex}</span> with</p>
                  <Swatches tokens={tokens} current={to?.hex ?? hex} onPick={(v) => onSwap(hex, tokens.find((t) => t.value === v)?.hex === hex ? null : v)} />
                </PopoverContent>
              </Popover>
              {to && (
                <button type="button" onClick={() => onSwap(hex, null)} aria-label="Back to the original colour" title="Back to the original"
                  className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-background text-foreground/60 shadow-[0_0_0_1px_rgba(0,0,0,0.1)] hover:text-foreground">
                  <HugeiconsIcon icon={Cancel01Icon} className="size-2.5" strokeWidth={2.5} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {Object.keys(theme).length > 0 && (
        <button type="button" onClick={onClear} className="text-foreground/50 underline-offset-4 hover:text-foreground hover:underline">Back to the original colours</button>
      )}
      <div className="space-y-1.5 border-t border-foreground/[0.06] pt-4 text-foreground/55">
        <Tip keys={['Click']} text="select" more={['⌘', 'Click']} moreText="add" />
        <Tip keys={['Drag']} text="move" more={['⌘']} moreText="move freely" />
        <Tip keys={['Scroll']} text="pan" more={['⌘', 'Scroll']} moreText="zoom" />
      </div>
    </div>
  );
}

function Tip({ keys, text, more, moreText }: { keys: string[]; text: string; more: string[]; moreText: string }) {
  const k = (x: string) => <kbd key={x} className="rounded-[3px] bg-foreground/[0.06] px-1 py-px font-sans text-[11px] text-foreground/70">{x}</kbd>;
  return <p className="flex flex-wrap items-center gap-1">{keys.map(k)} {text} <span className="text-foreground/25">·</span> {more.map(k)} {moreText}</p>;
}

function Panel({ comp, onReset, children }: { comp: Comp; onReset?: () => void; children: React.ReactNode }) {
  return (
    <div className="space-y-5 px-4 py-4 text-[12px]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">{comp.name}</p>
          <p className="text-foreground/40">{KIND_LABEL[comp.kind]}{comp.slot || comp.textSlot ? ' · from the brief' : ''}</p>
        </div>
        {onReset && (
          <button type="button" onClick={onReset} title="Undo every change on this component" className="flex h-6 shrink-0 items-center gap-1 rounded-md bg-foreground/[0.05] px-2 text-foreground/60 hover:bg-foreground/[0.09] hover:text-foreground">
            <HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-3" /> Reset
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function TextControls({ info, edit, tokens, slot, onText, onEdit }: {
  id: string; info: LayerInfo; edit?: NodeEdit; tokens: Token[]; slot: { value: string | null; meta?: SlotMeta } | null;
  onText: (t: string) => void; onEdit: (e: NodeEdit, commit?: boolean) => void;
}) {
  return (
    <Section title="Text">
      <TextField value={slot ? slot.value ?? '' : edit?.text ?? info.text} onCommit={onText} optional={!slot || slot.meta?.optional} />
      <Row label="Size">
        <NumberField label="Aa" value={edit?.style?.fontSize ?? info.fontSize} suffix="px" min={slot?.meta?.fontSize?.min ?? 8} max={slot?.meta?.fontSize?.max ?? 400} onChange={(v, c) => onEdit({ style: { fontSize: v } }, c)} />
      </Row>
      {slot?.meta?.fontSize && <p className="-mt-1 text-foreground/40">This text goes from {slot.meta.fontSize.min} to {slot.meta.fontSize.max}px.</p>}
      <Row label="Weight">
        <div className="grid grid-cols-4 gap-0.5 rounded-[5px] bg-foreground/[0.05] p-0.5">
          {WEIGHTS.map(([w, label]) => (
            <button key={w} type="button" title={label} onClick={() => onEdit({ style: { fontWeight: w } })}
              className={`h-6 rounded-[4px] text-[11px] ${(edit?.style?.fontWeight ?? info.fontWeight) === w ? 'bg-background font-medium shadow-[0_0_0_1px_rgba(0,0,0,0.06)]' : 'text-foreground/55 hover:text-foreground'}`}
              style={{ fontWeight: w }}>Aa</button>
          ))}
        </div>
      </Row>
      <Row label="Colour"><ColorField tokens={tokens} current={info.color} onPick={(v) => onEdit({ style: { color: v } })} /></Row>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5 border-t border-foreground/[0.06] pt-4">
      <p className="text-[11px] font-medium tracking-[0.02em] text-foreground/40">{title}</p>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-2">
      <span className="text-foreground/50">{label}</span>
      {children}
    </div>
  );
}

function Toggle({ hidden, label, onToggle }: { hidden: boolean; label: string; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md bg-foreground/[0.05] text-foreground/70 hover:bg-foreground/[0.09] hover:text-foreground">
      <HugeiconsIcon icon={hidden ? ViewIcon : ViewOffSlashIcon} className="size-3.5" /> {hidden ? `Show ${label}` : `Hide ${label}`}
    </button>
  );
}

function TextField({ value, onCommit, optional }: { value: string; onCommit: (v: string) => void; optional?: boolean }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => {
    if (v === value) return;
    if (!v.trim() && !optional) { toast.error('This copy is essential to the piece. Write something shorter instead.'); setV(value); return; }
    onCommit(v);
  };
  return (
    <Textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} rows={Math.min(5, Math.max(2, v.split('\n').length))}
      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); } }}
      className="min-h-0 resize-none text-[12px]" />
  );
}

// A number: type it, use ↑↓ (Shift ×10), or drag its label sideways to scrub (Shift ×10), like design
// tools. Dragging shows the change live and makes one undo step when released.
function NumberField({ label, value, suffix, min = -9999, max = 9999, onChange }: { label?: string; value: number; suffix?: string; min?: number; max?: number; onChange: (v: number, commit: boolean) => void }) {
  const [v, setV] = useState(String(value));
  const drag = useRef<{ x: number; v0: number; last: number } | null>(null);
  useEffect(() => { if (!drag.current) setV(String(value)); }, [value]);
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const commit = () => {
    const n = Number(v);
    if (!Number.isFinite(n)) { setV(String(value)); return; }
    const c = clamp(n);
    setV(String(c));
    if (c !== value) onChange(c, true);
  };
  return (
    <label className="flex h-7 items-center gap-1.5 rounded-md bg-foreground/[0.04] px-2 focus-within:ring-1 focus-within:ring-primary/40">
      {label && (
        <span
          className="min-w-3 shrink-0 cursor-ew-resize text-foreground/40 select-none hover:text-foreground"
          title="Drag to change"
          onPointerDown={(e) => { e.preventDefault(); drag.current = { x: e.clientX, v0: value, last: value }; (e.currentTarget as Element).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const n = clamp(d.v0 + (e.clientX - d.x) * (e.shiftKey ? 10 : 1));
            if (n === d.last) return;
            d.last = n;
            setV(String(n));
            onChange(n, false);
          }}
          onPointerUp={() => { const d = drag.current; drag.current = null; if (d && d.last !== d.v0) onChange(d.last, true); }}
        >{label}</span>
      )}
      <input value={v} inputMode="numeric" onChange={(e) => setV(e.target.value)} onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const n = clamp(Number(v) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)); setV(String(n)); onChange(n, true); }
        }}
        className="w-full min-w-0 bg-transparent tabular-nums outline-none" />
      {suffix && <span className="text-foreground/35">{suffix}</span>}
    </label>
  );
}

// A group's layout, Figma-like but small: how its content is spread (packed with a gap, or space
// between), where packed content sits, and how it lines up across.
function LayoutControls({ layout, onEdit }: { layout: NonNullable<LayerInfo['layout']>; onEdit: (l: NonNullable<NodeEdit['layout']>, commit?: boolean) => void }) {
  const vertical = layout.direction === 'column';
  const between = layout.distribute === 'space-between';
  const main = vertical ? [['start', AlignTopIcon], ['center', AlignVerticalCenterIcon], ['end', AlignBottomIcon]] as const : [['start', AlignLeftIcon], ['center', AlignHorizontalCenterIcon], ['end', AlignRightIcon]] as const;
  const cross = vertical ? [['start', AlignLeftIcon], ['center', AlignHorizontalCenterIcon], ['end', AlignRightIcon]] as const : [['start', AlignTopIcon], ['center', AlignVerticalCenterIcon], ['end', AlignBottomIcon]] as const;
  const seg = (on: boolean) => `h-6 rounded-[4px] ${on ? 'bg-background font-medium shadow-[0_0_0_1px_rgba(0,0,0,0.06)]' : 'text-foreground/55 hover:text-foreground'}`;
  const icons = (items: typeof main | typeof cross, value: string, pick: (k: 'start' | 'center' | 'end') => void, disabled = false) => (
    <div className={`grid grid-cols-3 gap-0.5 rounded-[5px] bg-foreground/[0.05] p-0.5 ${disabled ? 'opacity-40' : ''}`}>
      {items.map(([k, icon]) => (
        <button key={k} type="button" disabled={disabled} onClick={() => pick(k)} aria-label={k} className={`flex items-center justify-center ${seg(value === k)}`}>
          <HugeiconsIcon icon={icon} className="size-3.5" strokeWidth={1.6} />
        </button>
      ))}
    </div>
  );
  return (
    <Section title={`Layout · ${vertical ? 'vertical' : 'horizontal'}`}>
      <div className="grid grid-cols-2 gap-0.5 rounded-[5px] bg-foreground/[0.05] p-0.5 text-[12px]">
        <button type="button" onClick={() => onEdit({ distribute: 'packed' })} className={seg(!between)}>Packed</button>
        <button type="button" onClick={() => onEdit({ distribute: 'space-between' })} className={seg(between)}>Space between</button>
      </div>
      {!between && <Row label="Gap"><NumberField label="↔" value={layout.gap} suffix="px" min={0} max={600} onChange={(v, c) => onEdit({ gap: v }, c)} /></Row>}
      <Row label={vertical ? 'Place' : 'Place'}>{icons(main, layout.position, (k) => onEdit({ distribute: 'packed', position: k }), between)}</Row>
      <Row label="Align">{icons(cross, layout.align, (k) => onEdit({ align: k }))}</Row>
      <p className="text-[11px] text-foreground/40">{between ? 'The first and last items sit at the edges; the space is shared between them.' : 'Items stay together, with this gap between them.'}</p>
    </Section>
  );
}

function SliderField({ value, min, max, suffix, onChange }: { value: number; min: number; max: number; suffix: string; onChange: (v: number, commit: boolean) => void }) {
  return (
    <div className="flex items-center gap-2.5">
      <Slider value={[value]} min={min} max={max} onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v, false)} onValueCommitted={(v) => onChange(Array.isArray(v) ? v[0] : v, true)} />
      <span className="w-9 shrink-0 text-right text-foreground/50 tabular-nums">{value}{suffix}</span>
    </div>
  );
}

// One colour: a chip with its name; the brand palette opens on click.
function ColorField({ tokens, current, onPick }: { tokens: Token[]; current: string; onPick: (v: string) => void }) {
  const t = tokens.find((x) => x.hex === current);
  return (
    <Popover>
      <PopoverTrigger className="flex h-7 w-full items-center gap-2 rounded-md bg-foreground/[0.04] px-1.5 text-left hover:bg-foreground/[0.07]">
        <span className="size-4 shrink-0 rounded-[4px] ring-1 ring-foreground/10 ring-inset" style={{ background: current || 'transparent' }} />
        <span className="min-w-0 flex-1 truncate">{t?.name ?? (current || 'None')}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[248px] p-3">
        <p className="pb-2.5 text-[12px]"><span className="font-medium">{t?.name ?? 'Colour'}</span> <span className="text-foreground/40">{current}</span></p>
        <Swatches tokens={tokens} current={current} onPick={onPick} />
      </PopoverContent>
    </Popover>
  );
}

// The brand palette: one tidy grid per family (8 across), the current colour ticked, name and hex on
// hover.
const light = (hex: string) => { const n = parseInt(hex.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 > 0.6; };
function Swatches({ tokens, current, onPick }: { tokens: Token[]; current: string; onPick: (v: string) => void }) {
  const groups = (['Blues', 'Neutrals', 'Accents'] as const).map((g) => [g, tokens.filter((t) => t.group === g)] as const).filter(([, l]) => l.length);
  return (
    <div className="space-y-2.5">
      {groups.map(([g, list]) => (
        <div key={g}>
          <p className="pb-1 text-[10px] font-medium tracking-[0.04em] text-foreground/35 uppercase">{g}</p>
          <div className="grid grid-cols-8 gap-1">
            {list.map((t) => (
              <Tooltip key={t.hex}>
                <TooltipTrigger render={<button type="button" aria-label={t.name} onClick={() => onPick(t.value)} />}
                  className={`relative flex aspect-square items-center justify-center rounded-[5px] ring-1 ring-inset transition-transform hover:scale-110 ${t.hex === current ? 'ring-2 ring-primary ring-offset-1' : 'ring-foreground/10'}`}
                  style={{ backgroundColor: t.hex }}>
                  {t.hex === current && <HugeiconsIcon icon={Tick02Icon} className={`size-3 ${light(t.hex) ? 'text-[#00004E]' : 'text-white'}`} strokeWidth={2.5} />}
                </TooltipTrigger>
                <TooltipContent side="top">{t.name} <span className="text-background/60">{t.hex}</span></TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ImagePicker({ kind, preview, library, onPick }: { kind: Comp['kind']; preview: string | null; library: LibraryItem[]; onPick: (v: string) => void }) {
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
    <div className="space-y-2">
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className={`h-24 w-full rounded-md bg-[repeating-conic-gradient(#f2f2f2_0_25%,#fff_0_50%)] bg-[length:12px_12px] object-contain ring-1 ring-foreground/[0.06] ${kind === 'partner' ? 'p-3' : ''}`} />
      )}
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" disabled={busy} onClick={() => input.current?.click()}
          className={`flex h-7 items-center justify-center gap-1.5 rounded-md bg-foreground/[0.05] text-foreground/80 hover:bg-foreground/[0.09] disabled:opacity-50 ${library.length ? '' : 'col-span-2'}`}>
          <HugeiconsIcon icon={ImageUploadIcon} className="size-3.5" /> {busy ? 'Uploading…' : 'Upload'}
        </button>
        {library.length > 0 && (
          <Popover>
            <PopoverTrigger className="flex h-7 items-center justify-center rounded-md bg-foreground/[0.05] text-foreground/80 hover:bg-foreground/[0.09]">Library</PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-2">
              <p className="px-1 pb-2 text-[11px] text-foreground/40">Approved images</p>
              <div className="grid grid-cols-3 gap-1.5">
                {library.map((a) => (
                  <button key={a.id} type="button" title={a.title} onClick={() => onPick(`asset:${a.id}`)} className="overflow-hidden rounded-md bg-foreground/[0.04] ring-1 ring-foreground/[0.06] hover:ring-primary">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url} alt={a.title} className="aspect-square w-full object-contain" />
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <p className="text-foreground/40">{kind === 'partner' ? 'A PNG or SVG with a transparent background. It takes the colour of the piece.' : 'PNG, JPG or WebP up to 4 MB. Cutouts look best with a transparent background.'}</p>
    </div>
  );
}
