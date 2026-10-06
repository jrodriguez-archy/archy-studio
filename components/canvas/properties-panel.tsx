'use client';

import { useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  AlignBottomIcon, AlignHorizontalCenterIcon, AlignLeftIcon, AlignRightIcon, AlignTopIcon, AlignVerticalCenterIcon,
  ArrowRight01Icon, ArrowTurnBackwardIcon, Delete02Icon, ImageUploadIcon, LockIcon, ViewIcon, ViewOffSlashIcon,
} from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
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
            <NumberField label="X" value={box.dx ?? 0} onCommit={(v) => onEdit(comp.id, { box: { dx: v } })} />
            <NumberField label="Y" value={box.dy ?? 0} onCommit={(v) => onEdit(comp.id, { box: { dy: v } })} />
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
          onText={(t) => (comp.slot ? onSlot(comp.slot, t) : onEdit(comp.id, { text: t }))} onEdit={(e) => onEdit(comp.id, e)} />
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

      {movable && me && (
        <Section title="Position">
          <AlignRow alignIn={alignIn} onAlign={onAlign} />
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="X" value={box.dx ?? 0} onCommit={(v) => onEdit(comp.id, { box: { dx: v } })} />
            <NumberField label="Y" value={box.dy ?? 0} onCommit={(v) => onEdit(comp.id, { box: { dy: v } })} />
            {comp.kind !== 'decoration' && (
              <>
                <NumberField label="W" value={box.width ?? me.width} min={4} onCommit={(v) => onEdit(comp.id, { box: { width: v } })} />
                <NumberField label="H" value={box.height ?? me.height} min={4} onCommit={(v) => onEdit(comp.id, { box: { height: v } })} />
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
        <p className="text-foreground/50">The brand colours in this piece. Change one and it changes everywhere it is used.</p>
      </div>
      <div className="space-y-1">
        {used.map((hex) => {
          const from = byHex.get(hex);
          const to = theme[hex] ? tokens.find((t) => t.value === theme[hex]) : null;
          return (
            <Popover key={hex}>
              <PopoverTrigger className="flex h-9 w-full items-center gap-2.5 rounded-md px-1.5 text-left hover:bg-foreground/[0.04]">
                <span className="size-5 shrink-0 rounded-full ring-1 ring-foreground/10 ring-inset" style={{ backgroundColor: hex }} />
                <span className={`min-w-0 flex-1 truncate ${to ? 'text-foreground/40 line-through' : ''}`}>{from?.name ?? hex}</span>
                {to && (
                  <>
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-3 shrink-0 text-foreground/40" />
                    <span className="size-5 shrink-0 rounded-full ring-1 ring-foreground/10 ring-inset" style={{ backgroundColor: to.hex }} />
                    <span className="max-w-24 truncate">{to.name}</span>
                  </>
                )}
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3">
                <p className="pb-2 text-[11px] text-foreground/40">Replace {from?.name ?? hex} with</p>
                <Swatches tokens={tokens} current={to?.hex ?? hex} onPick={(v) => onSwap(hex, tokens.find((t) => t.value === v)?.hex === hex ? null : v)} />
                {to && <button type="button" onClick={() => onSwap(hex, null)} className="mt-3 text-[12px] text-foreground/50 underline-offset-4 hover:text-foreground hover:underline">Keep the original</button>}
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
      {Object.keys(theme).length > 0 && (
        <button type="button" onClick={onClear} className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md bg-foreground/[0.05] text-foreground/70 hover:bg-foreground/[0.09]">
          <HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-3" /> Original colours
        </button>
      )}
      <div className="space-y-1.5 border-t border-foreground/[0.06] pt-4 text-foreground/50">
        <p className="text-foreground">Tips</p>
        <p>Click anything on the piece, or a component on the left. Double-click a text to type in place.</p>
        <p>Drag to move: it snaps to the centre and edges (hold ⌘ to move freely). Pull a handle to resize, Shift keeps proportions. Arrows nudge 1px, Shift+arrows 10px.</p>
      </div>
    </div>
  );
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
  onText: (t: string) => void; onEdit: (e: NodeEdit) => void;
}) {
  return (
    <Section title="Text">
      <TextField value={slot ? slot.value ?? '' : edit?.text ?? info.text} onCommit={onText} optional={!slot || slot.meta?.optional} />
      <Row label="Size">
        <NumberField value={edit?.style?.fontSize ?? info.fontSize} suffix="px" min={slot?.meta?.fontSize?.min ?? 8} max={slot?.meta?.fontSize?.max ?? 400} onCommit={(v) => onEdit({ style: { fontSize: v } })} />
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

function NumberField({ label, value, suffix, min = -9999, max = 9999, onCommit }: { label?: string; value: number; suffix?: string; min?: number; max?: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  const commit = () => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) { setV(String(value)); return; }
    const c = Math.min(max, Math.max(min, n));
    setV(String(c));
    if (c !== value) onCommit(c);
  };
  return (
    <label className="flex h-7 items-center gap-1.5 rounded-md bg-foreground/[0.04] px-2 focus-within:ring-1 focus-within:ring-primary/40">
      {label && <span className="w-3 shrink-0 text-foreground/40">{label}</span>}
      <input value={v} inputMode="numeric" onChange={(e) => setV(e.target.value)} onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const n = Math.min(max, Math.max(min, Number(v) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1))); setV(String(n)); onCommit(n); }
        }}
        className="w-full min-w-0 bg-transparent tabular-nums outline-none" />
      {suffix && <span className="text-foreground/35">{suffix}</span>}
    </label>
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
        <span className="size-4 shrink-0 rounded-full ring-1 ring-foreground/10 ring-inset" style={{ background: current || 'transparent' }} />
        <span className="min-w-0 flex-1 truncate">{t?.name ?? (current || 'None')}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-3">
        <Swatches tokens={tokens} current={current} onPick={onPick} />
      </PopoverContent>
    </Popover>
  );
}

// Brand swatches, grouped (Blues, Neutrals, Accents); the current colour is ringed.
function Swatches({ tokens, current, onPick }: { tokens: Token[]; current: string; onPick: (v: string) => void }) {
  const groups = (['Blues', 'Neutrals', 'Accents'] as const).map((g) => [g, tokens.filter((t) => t.group === g)] as const).filter(([, l]) => l.length);
  return (
    <div className="space-y-1.5">
      {groups.map(([g, list]) => (
        <div key={g} className="flex flex-wrap gap-1.5" title={g}>
          {list.map((t) => (
            <button key={t.hex} type="button" title={`${t.name} · ${t.hex}`} aria-label={t.name} onClick={() => onPick(t.value)}
              className={`size-5 rounded-full ring-1 ring-foreground/10 ring-inset ${t.hex === current ? 'outline-2 outline-offset-1 outline-primary' : ''}`}
              style={{ backgroundColor: t.hex }} />
          ))}
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
