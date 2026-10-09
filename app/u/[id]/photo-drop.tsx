'use client';

import { useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { CheckmarkCircle02Icon, ImageUploadIcon, Loading03Icon } from '@hugeicons/core-free-icons';
import { shrinkImage } from '@/lib/shrink-image';

type Item = { key: string; label: string; cutout: boolean; thumb: string | null };
type State = { thumb: string | null; busy: boolean; error: string | null; cutout?: boolean };

export function PhotoDrop({ id, items }: { id: string; items: Item[] }) {
  const [state, setState] = useState<Record<string, State>>(() => Object.fromEntries(items.map((i) => [i.key, { thumb: i.thumb, busy: false, error: null }])));
  const done = items.every((i) => state[i.key].thumb);

  const send = async (key: string, file: File | undefined) => {
    if (!file) return;
    setState((s) => ({ ...s, [key]: { ...s[key], busy: true, error: null } }));
    try {
      const body = new FormData();
      const small = await shrinkImage(file);
      body.append('file', small, small.name);
      const r = await fetch(`/api/photo-requests/${id}/${key}`, { method: 'POST', body });
      const j = await r.json().catch(() => ({ error: 'Something went wrong.' }));
      if (!r.ok) throw new Error(j.error);
      setState((s) => ({ ...s, [key]: { thumb: j.thumb, busy: false, error: null, cutout: j.cutout } }));
    } catch (e) {
      setState((s) => ({ ...s, [key]: { ...s[key], busy: false, error: (e as Error).message } }));
    }
  };

  return (
    <div className="space-y-3">
      {items.map((i) => <Drop key={i.key} item={i} state={state[i.key]} onFile={(f) => send(i.key, f)} />)}
      {done && (
        <p className="flex items-center gap-2 rounded-md bg-foreground/[0.04] px-3 py-2.5 text-[13px]">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 shrink-0 text-[#16A34A]" />
          Done. Go back to Claude and say so.
        </p>
      )}
    </div>
  );
}

function Drop({ item, state, onFile }: { item: Item; state: State; onFile: (f: File | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <button type="button" onClick={() => input.current?.click()} disabled={state.busy}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files[0]); }}
      className={`flex w-full items-center gap-3 rounded-md border border-dashed p-3 text-left transition-colors ${over ? 'border-primary bg-primary/[0.04]' : 'border-foreground/15 hover:bg-foreground/[0.02]'}`}>
      <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-foreground/[0.05]">
        {state.thumb
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={state.thumb} alt="" className="size-full object-cover" />
          : <HugeiconsIcon icon={state.busy ? Loading03Icon : ImageUploadIcon} className={`size-5 text-foreground/40 ${state.busy ? 'animate-spin' : ''}`} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{item.label}</span>
        <span className={`block text-[12px] ${state.error ? 'text-destructive' : 'text-muted-foreground'}`}>
          {state.error ?? (state.busy ? (item.cutout ? 'Uploading and removing the background…' : 'Uploading…') : state.thumb ? (state.cutout ? 'Added, background removed. Drop another to replace it.' : 'Added. Drop another to replace it.') : 'Drop a photo or choose one')}
        </span>
      </span>
      {state.thumb && !state.busy && <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 shrink-0 text-[#16A34A]" />}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
    </button>
  );
}
