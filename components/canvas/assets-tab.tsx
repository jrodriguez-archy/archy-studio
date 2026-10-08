'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  AiMagicIcon, Folder01Icon, FolderAddIcon, FolderExportIcon, InformationCircleIcon, Cancel01Icon, ArrowLeft01Icon, ArrowRight01Icon, Delete02Icon, Download04Icon, Maximize01Icon, UserIcon, ZoomInAreaIcon, DashboardSquare01Icon, GridIcon, ImageUploadIcon, MagicWand01Icon, PencilEdit02Icon, Scissor01Icon, SparklesIcon,
} from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import { ClickActions, ContextActions, MoreActions, type Action } from '@/components/action-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Asset, Folder } from '@/lib/assets';
import { PALETTES, PIXEL_SIZES, drawPixelBackground, loadImage, pixelBackground, pixelDissolve, pixelTone, swatch, type PaletteKey, type PixelSize, type Tone } from '@/lib/pixel-effects';

type Lists = { mine: Asset[]; team: Asset[] };
const RATIOS = [['4:5', 'Post'], ['1:1', 'Square'], ['9:16', 'Story'], ['16:9', 'Wide']] as const;
const KIND: Record<Asset['kind'], string> = { upload: 'Upload', cutout: 'Cutout', pixel: 'Pixel effect', generated: 'Generated' };

// What this browser session changed (new images, renames, removals, folders and moves), kept across tab
// switches and the library's live reloads, which bring the server's list again.
const session = {
  added: [] as Asset[], gone: new Set<string>(), names: new Map<string, string>(), folderOf: new Map<string, string | null>(),
  folders: [] as Folder[], foldersGone: new Set<string>(), folderNames: new Map<string, string>(),
  /** Images moved in (+) or out (−) of each folder this session, on top of the server's counts. */
  counts: new Map<string, number>(),
};
const bump = (id: string | null | undefined, by: number) => { if (id) session.counts.set(id, (session.counts.get(id) ?? 0) + by); };
export function withSession(base: Lists): Lists {
  const fix = (l: Asset[]) => {
    const seen = new Set<string>();
    return l.filter((a) => !session.gone.has(a.id) && !seen.has(a.id) && !!seen.add(a.id))
      .map((a) => {
        // The server caught up with a move made here: the local note is no longer needed.
        if (session.folderOf.has(a.id) && session.folderOf.get(a.id) === a.folderId && !session.added.includes(a)) session.folderOf.delete(a.id);
        return a;
      })
      .map((a) => ({
        ...a,
        ...(session.names.has(a.id) ? { name: session.names.get(a.id)! } : {}),
        ...(session.folderOf.has(a.id) ? { folderId: session.folderOf.get(a.id)! } : {}),
      }))
      // An image whose folder was removed is back out of any folder.
      .map((a) => (a.folderId && session.foldersGone.has(a.folderId) ? { ...a, folderId: null } : a));
  };
  return { mine: fix([...session.added, ...base.mine]), team: fix([...session.added, ...base.team]) };
}
function foldersWithSession(base: Folder[]): Folder[] {
  const seen = new Set<string>();
  // Folders made here that the server now lists come from the server (so a removal elsewhere shows).
  session.folders = session.folders.filter((f) => !(base ?? []).some((b) => b.id === f.id));
  return [...(base ?? []), ...session.folders]
    .filter((f) => !session.foldersGone.has(f.id) && !seen.has(f.id) && !!seen.add(f.id))
    .map((f) => ({ ...f, count: Math.max(0, f.count + (session.counts.get(f.id) ?? 0)), ...(session.folderNames.has(f.id) ? { name: session.folderNames.get(f.id)! } : {}) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
const MAX_UPLOAD = 4_000_000;

// Assets: the images the team brings to Studio, and what Studio makes from them. Click one to place it
// in the selected photo or logo (or, with nothing selected, to see what can be done with it);
// right-click for the same options: remove the background, Archy's pixel effects, edit with AI.
export function AssetsTab({ assets, folders: baseFolders, target, onPick }: { assets: Lists; folders: Folder[]; target: string | null; onPick: (value: string) => void }) {
  const [tick, setTick] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lists = useMemo(() => withSession(assets), [assets, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const folders = useMemo(() => foldersWithSession(baseFolders), [baseFolders, tick]);
  // The folder open (null: the top, with the folders and the images in none).
  const [folder, setFolder] = useState<string | null>(null);
  const here = folders.find((f) => f.id === folder) ?? null;
  useEffect(() => { if (folder && !here) setFolder(null); }, [folder, here]);
  // Several images picked (⌘/Shift-click) to move or remove together.
  const [picked, setPicked] = useState<string[]>([]);
  const [naming, setNaming] = useState<{ title: string; action: string; initial: string; done: (name: string) => void } | null>(null);
  const [confirming, setConfirming] = useState<{ title: string; text: string; action: string; done: () => void } | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  // A folder's own images, from the server (all of them, not only the newest the panel loaded).
  const [inFolder, setInFolder] = useState<Record<string, Lists>>({});
  useEffect(() => {
    if (!folder) return;
    let gone = false;
    Promise.all([fetch(`/api/assets?folder=${folder}`), fetch(`/api/assets?folder=${folder}&whose=mine`)])
      .then(async ([t, m]) => (t.ok && m.ok ? { team: (await t.json()).assets as Asset[], mine: (await m.json()).assets as Asset[] } : null))
      .then((l) => { if (l && !gone) setInFolder((x) => ({ ...x, [folder]: l })); })
      .catch(() => {});
    return () => { gone = true; };
  }, [folder]);
  // A new place or a new filter starts with nothing picked.
  useEffect(() => setPicked([]), [folder]);
  const [whose, setWhose] = useState<'mine' | 'team'>('mine');
  useEffect(() => setPicked([]), [whose]);
  const [working, setWorking] = useState<{ key: string; label: string; folder: string | null }[]>([]);
  const [ai, setAi] = useState<{ from: Asset | null } | null>(null);
  const [renaming, setRenaming] = useState<Asset | null>(null);
  const [pixelBg, setPixelBg] = useState<Asset | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // In a folder: what the server holds there plus what this session added or moved in.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const here_lists = useMemo(() => (folder && inFolder[folder] ? withSession({ mine: [...inFolder[folder].mine, ...assets.mine], team: [...inFolder[folder].team, ...assets.team] }) : lists), [folder, inFolder, lists, assets]);
  const mineIds = new Set([...lists.mine, ...here_lists.mine].map((a) => a.id));
  const list = (whose === 'mine' ? here_lists.mine : here_lists.team).filter((a) => (a.folderId ?? null) === folder);
  // Picked images that are still on screen (a removed one drops out).
  const shownPicked = picked.filter((id) => list.some((a) => a.id === id));
  const count = (id: string) => folders.find((f) => f.id === id)?.count ?? 0;

  const add = (a: Asset) => { session.added.unshift(a); bump(a.folderId, 1); setTick((t) => t + 1); };
  const json = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Try again.');
    return data;
  };

  // ---- Folders ----
  // Removed meanwhile (by someone else, or in another tab): it leaves this view too.
  const folderGone = (id: string, e: Error) => {
    if (!/not found/i.test(e.message)) { toast.error(e.message); return; }
    session.foldersGone.add(id);
    if (folder === id) setFolder(null);
    setTick((t) => t + 1);
    toast('This folder was deleted.');
  };
  const move = async (ids: string[], to: string | null, toName?: string) => {
    const all = [...here_lists.team, ...here_lists.mine, ...lists.team, ...lists.mine];
    const was = new Map(ids.map((id) => [id, all.find((a) => a.id === id)?.folderId ?? null]));
    ids = ids.filter((id) => was.get(id) !== to); // already there
    if (!ids.length) return;
    const shift = (sign: number) => { for (const id of ids) { bump(was.get(id), -sign); bump(to, sign); } };
    for (const id of ids) session.folderOf.set(id, to);
    shift(1);
    setTick((t) => t + 1);
    setPicked([]);
    try {
      await json('/api/assets/move', 'POST', { ids, folderId: to });
      const name = to ? toName ?? folders.find((f) => f.id === to)?.name ?? 'the folder' : null;
      toast(`${ids.length > 1 ? `${ids.length} images` : 'Image'} ${name ? `moved to ${name}` : 'moved out of the folder'}`);
    } catch (e) {
      for (const [id, f] of was) session.folderOf.set(id, f);
      shift(-1);
      setTick((t) => t + 1);
      if (to && /folder not found/i.test((e as Error).message)) folderGone(to, e as Error); else toast.error((e as Error).message);
    }
  };
  const newFolder = (then?: (f: Folder) => void) => setNaming({
    title: 'New folder', action: 'Create', initial: '',
    done: async (name) => {
      try {
        const { folder: f } = await json('/api/assets/folders', 'POST', { name });
        session.folders.push(f as Folder);
        setTick((t) => t + 1);
        then?.(f as Folder);
      } catch (e) { toast.error((e as Error).message); }
    },
  });
  const folderActions = (f: Folder): Action[] => [
    { label: 'Open', icon: Folder01Icon, onSelect: () => setFolder(f.id) },
    { label: 'Rename…', icon: PencilEdit02Icon, onSelect: () => setNaming({
      title: 'Rename folder', action: 'Save', initial: f.name,
      done: async (name) => {
        try { const r = await json(`/api/assets/folders/${f.id}`, 'PATCH', { name }); session.folderNames.set(f.id, r.name ?? name); setTick((t) => t + 1); }
        catch (e) { folderGone(f.id, e as Error); }
      },
    }) },
    { label: 'Delete folder', icon: Delete02Icon, destructive: true, onSelect: () => setConfirming({
      title: `Delete “${f.name}”?`, text: 'The folder goes. Its images stay in Assets, out of any folder.', action: 'Delete folder',
      done: async () => {
        try { await json(`/api/assets/folders/${f.id}`, 'DELETE'); session.foldersGone.add(f.id); if (folder === f.id) setFolder(null); setTick((t) => t + 1); }
        catch (e) { folderGone(f.id, e as Error); }
      },
    }) },
  ];
  // "Move to folder" for one image or several.
  const moveItems = (ids: string[], from: string | null): Action[] => [
    ...folders.filter((f) => f.id !== from).map((f) => ({ label: f.name, icon: Folder01Icon, onSelect: () => move(ids, f.id) })),
    ...(folders.some((f) => f.id !== from) ? [{ separator: true } as const] : []),
    { label: 'New folder…', icon: FolderAddIcon, onSelect: () => newFolder((f) => move(ids, f.id, f.name)) },
    ...(from ? [{ label: 'Out of the folder', icon: FolderExportIcon, onSelect: () => move(ids, null) }] : []),
  ];
  const drop = (id: string) => {
    bump([...here_lists.team, ...lists.team].find((a) => a.id === id)?.folderId, -1);
    session.gone.add(id); setPicked((p) => p.filter((x) => x !== id)); setTick((t) => t + 1);
  };
  const rename = (id: string, name: string) => { session.names.set(id, name); setTick((t) => t + 1); };

  // A job started from the large view: the view follows that one job and shows its result.
  const fromViewer = useRef(false);
  const [viewerJob, setViewerJob] = useState<string | null>(null);
  const viewerJobRef = useRef<string | null>(null);
  const followJob = (key: string | null) => { viewerJobRef.current = key; setViewerJob(key); };

  // Every job shows a placeholder until its image arrives, then joins Mine (and Team).
  // `into`: the folder the result lands in (its placeholder shows there only).
  const job = async (label: string, run: () => Promise<Asset>, into: string | null = folder) => {
    const key = Math.random().toString(36).slice(2);
    setWorking((w) => [{ key, label, folder: into }, ...w]);
    if (fromViewer.current) { fromViewer.current = false; followJob(key); } else setWhose('mine');
    try {
      const a = await run();
      add(a);
      if (viewerJobRef.current === key) { followJob(null); setViewing(a.id); }
    } catch (e) {
      if (viewerJobRef.current === key) followJob(null);
      toast.error((e as Error).message);
    } finally { setWorking((w) => w.filter((x) => x.key !== key)); }
  };
  const send = async (body: FormData) => {
    const res = await fetch('/api/uploads', { method: 'POST', body });
    const data = await res.json().catch(() => ({}));
    if (res.status === 413) throw new Error('The image is larger than 4 MB. Export it smaller and try again.');
    if (!res.ok) throw new Error(data.error ?? 'Could not save the image.');
    return data.asset as Asset;
  };
  const post = async (url: string, json?: unknown) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json ?? {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Try again.');
    return data.asset as Asset;
  };

  const upload = (file: File) => (file.size > MAX_UPLOAD
    ? Promise.resolve(toast.error('The image is larger than 4 MB. Export it smaller and try again.'))
    : job(file.name.replace(/\.\w+$/, ''), async () => {
    const body = new FormData();
    body.set('file', file);
    if (folder) body.set('folder', folder);
    const a = await send(body);
    if (target) onPick(a.value);
    return a;
  })).finally(() => { if (input.current) input.current.value = ''; });

  const effect = (a: Asset, label: string, make: (src: string) => Promise<Blob>) => job(`${a.name} · ${label}`, async () => {
    const blob = await make(`/api/assets/${a.id}/file`);
    const body = new FormData();
    body.set('file', new File([blob], 'effect', { type: blob.type }));
    body.set('kind', 'pixel');
    body.set('parent', a.id);
    body.set('name', `${a.name} · ${label}`);
    if (a.folderId) body.set('folder', a.folderId);
    return send(body);
  }, a.folderId);
  const tones: Tone[] = ['royal', 'navy'];
  const label = (t: Tone) => (t === 'royal' ? 'Royal' : 'Navy');

  const actions = (a: Asset, inViewer = false): Action[] => [
    ...(inViewer ? [] : [{ label: 'View large', icon: ZoomInAreaIcon, onSelect: () => setViewing(a.id) }]),
    ...(target ? [{ label: 'Use in the design', icon: ImageUploadIcon, onSelect: () => onPick(a.value) }, { separator: true } as const] : []),
    { label: 'Remove background', icon: Scissor01Icon, onSelect: () => job(`${a.name} · cutout`, () => post(`/api/assets/${a.id}/cutout`), a.folderId) },
    { label: 'Pixel tone', icon: GridIcon, items: tones.map((t) => ({ label: label(t), onSelect: () => effect(a, `pixel tone ${label(t).toLowerCase()}`, (s) => pixelTone(s, t)) })) },
    { label: 'Pixel dissolve', icon: DashboardSquare01Icon, items: tones.map((t) => ({ label: label(t), onSelect: () => effect(a, `pixel dissolve ${label(t).toLowerCase()}`, (s) => pixelDissolve(s, t)) })) },
    { label: 'Pixel background…', icon: UserIcon, onSelect: () => setPixelBg(a) },
    { label: 'Edit with AI…', icon: MagicWand01Icon, onSelect: () => setAi({ from: a }) },
    { separator: true },
    { label: 'Move to folder', icon: Folder01Icon, items: moveItems([a.id], a.folderId) },
    ...(mineIds.has(a.id) ? [
      { separator: true } as const,
      { label: 'Rename…', icon: PencilEdit02Icon, onSelect: () => setRenaming(a) },
      { label: 'Remove from Assets', icon: Delete02Icon, destructive: true, onSelect: async () => {
        const res = await fetch(`/api/assets/${a.id}`, { method: 'DELETE' });
        const msg = res.ok ? null : (await res.json().catch(() => ({}))).error ?? 'Could not remove it.';
        if (res.ok || /not found/i.test(msg)) drop(a.id); else toast.error(msg);
      } },
    ] : []),
  ];

  const tile = (a: Asset) => {
    const face = (
      <>
        <span className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-[repeating-conic-gradient(#f2f2f2_0_25%,#fff_0_50%)] bg-[length:10px_10px] p-1 ring-1 ring-foreground/[0.06] transition-shadow group-hover:ring-primary/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.thumb} alt={a.name} loading="lazy" decoding="async" draggable={false} className="max-h-full max-w-full object-contain" />
        </span>
        <span className="mt-1 block truncate text-left">{a.name}</span>
        <span className="block truncate text-left text-foreground/40">{whose === 'team' ? a.author : KIND[a.kind]}</span>
      </>
    );
    const isPicked = picked.includes(a.id);
    // ⌘/Shift-click picks several (to move or remove together); a plain click does what it always did.
    const pickClick = (e: React.MouseEvent) => {
      if (!(e.metaKey || e.ctrlKey || e.shiftKey)) return false;
      e.preventDefault(); e.stopPropagation();
      setPicked((p) => (p.includes(a.id) ? p.filter((x) => x !== a.id) : [...p, a.id]));
      return true;
    };
    return (
      <ContextActions key={a.id} actions={actions(a)} className={`group relative block min-w-0 rounded-md ${isPicked ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
        <div aria-pressed={isPicked} onDoubleClick={() => setViewing(a.id)} onClickCapture={(e) => { pickClick(e); }}
          // ⌘/Shift on press: marking, not opening anything.
          onMouseDownCapture={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) { e.preventDefault(); e.stopPropagation(); } }}
          draggable onDragStart={(e) => {
            const ids = isPicked ? shownPicked : [a.id];
            e.dataTransfer.setData('application/x-studio-assets', JSON.stringify(ids));
            e.dataTransfer.effectAllowed = 'move';
          }}>
        {target ? (
          <button type="button" title={`Place ${a.name}`} onClick={() => onPick(a.value)} className="block w-full">{face}</button>
        ) : (
          <ClickActions actions={actions(a)} label={`${a.name}: options`} className="block w-full outline-none">{face}</ClickActions>
        )}
        </div>
        <span className="absolute top-1 right-1 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <button type="button" aria-label={`View ${a.name} large`} title="View large" onClick={() => setViewing(a.id)}
            className="flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm outline-none">
            <HugeiconsIcon icon={Maximize01Icon} className="size-3" />
          </button>
          <MoreActions actions={actions(a)} label={`${a.name}: options`} className="flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm outline-none" />
        </span>
      </ContextActions>
    );
  };

  return (
    <div className="space-y-3 pb-4 text-[12px]" onKeyDown={(e) => { if (e.key === 'Escape' && picked.length) { e.stopPropagation(); setPicked([]); } }}>
      <div className="grid grid-cols-2 gap-1.5 px-3 pt-1">
        <button type="button" onClick={() => input.current?.click()}
          className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-foreground/[0.05] text-foreground/80 hover:bg-foreground/[0.09]">
          <HugeiconsIcon icon={ImageUploadIcon} className="size-3.5" /> Upload
        </button>
        <button type="button" onClick={() => setAi({ from: null })}
          className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-[#E6F4FF] font-medium text-primary hover:bg-[#d6ecff]">
          <HugeiconsIcon icon={AiMagicIcon} className="size-3.5" /> Generate
        </button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>

      <div className="mx-3 flex items-center gap-1.5">
      <div role="tablist" aria-label="Whose images" className="grid h-8 flex-1 grid-cols-2 gap-0.5 rounded-md bg-foreground/[0.05] p-0.5">
        {(['mine', 'team'] as const).map((w) => (
          <button key={w} type="button" role="tab" aria-selected={whose === w} onClick={() => setWhose(w)}
            className={`rounded-[5px] text-[12px] transition-colors ${whose === w ? 'bg-background font-medium text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.06)]' : 'text-foreground/50 hover:text-foreground'}`}>
            {w === 'mine' ? 'Mine' : 'Team'}
          </button>
        ))}
      </div>

      {/* How it works, on demand: the panel stays clean. */}
      <Tooltip>
        <TooltipTrigger render={<button type="button" aria-label="How Assets work" />}
          className={`flex size-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-foreground/[0.05] ${target ? 'text-primary' : 'text-foreground/40 hover:text-foreground'}`}>
          <HugeiconsIcon icon={InformationCircleIcon} className="size-4" strokeWidth={1.6} />
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[240px]">
          {target ? 'Click an image to place it in the selected photo or logo.' : 'Click an image (or right-click) to remove its background, add a pixel effect or edit it with AI. Double-click to see it large.'}
        </TooltipContent>
      </Tooltip>
      </div>

      {shownPicked.length > 0 && (
        <div className="mx-3 flex items-center gap-1 rounded-md bg-[#E6F4FF] py-1 pr-1 pl-2.5 text-primary">
          <span className="flex-1 font-medium">{shownPicked.length} selected</span>
          <ClickActions actions={moveItems(shownPicked, folder)} label="Move to folder"
            className="flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium outline-none hover:bg-white/60">
            <HugeiconsIcon icon={Folder01Icon} className="size-3.5" /> Move to
          </ClickActions>
          <button type="button" title="Clear" aria-label="Clear the selection" onClick={() => setPicked([])} className="flex size-7 items-center justify-center rounded-md hover:bg-white/60">
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
          </button>
        </div>
      )}

      {/* Where you are: the top of Assets, or one folder (drop images on "Assets" to take them out). */}
      {here ? (
        <div className="mx-3 flex items-center gap-1 text-[12px]">
          <button type="button" onClick={() => setFolder(null)}
            onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-studio-assets')) { e.preventDefault(); setDropOn('top'); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropOn(null); }}
            onDrop={(e) => { e.preventDefault(); setDropOn(null); move(JSON.parse(e.dataTransfer.getData('application/x-studio-assets') || '[]'), null); }}
            className={`flex h-7 items-center gap-1 rounded-md px-1.5 text-foreground/55 hover:bg-foreground/[0.05] hover:text-foreground ${dropOn === 'top' ? 'bg-[#E6F4FF] text-primary ring-1 ring-primary/50' : ''}`}>
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" /> Assets
          </button>
          <span className="text-foreground/30">/</span>
          <span className="min-w-0 flex-1 truncate font-medium">{here.name}</span>
          <MoreActions actions={folderActions(here).slice(1)} label="Folder options" className="flex size-7 items-center justify-center rounded-md text-foreground/50 outline-none hover:bg-foreground/[0.05] hover:text-foreground" />
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center px-3">
            <span className="flex-1 text-[11px] font-medium tracking-[0.02em] text-foreground/45">Folders</span>
            <button type="button" onClick={() => newFolder()} className="flex h-6 items-center gap-1 rounded-md px-1.5 text-foreground/55 hover:bg-foreground/[0.05] hover:text-foreground">
              <HugeiconsIcon icon={FolderAddIcon} className="size-3.5" /> New folder
            </button>
          </div>
          {folders.length > 0 ? (
            <div className="grid grid-cols-2 gap-1.5 px-3">
              {folders.map((f) => (
                <ContextActions key={f.id} actions={folderActions(f)} className="block min-w-0">
                  <button type="button" onClick={() => setFolder(f.id)}
                    onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-studio-assets')) { e.preventDefault(); setDropOn(f.id); } }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropOn(null); }}
                    onDrop={(e) => { e.preventDefault(); setDropOn(null); move(JSON.parse(e.dataTransfer.getData('application/x-studio-assets') || '[]'), f.id); }}
                    className={`flex h-10 w-full items-center gap-2 rounded-md px-2 text-left ring-1 transition-colors ${dropOn === f.id ? 'bg-[#E6F4FF] ring-primary/60' : 'bg-foreground/[0.03] ring-foreground/[0.06] hover:bg-foreground/[0.06]'}`}>
                    <HugeiconsIcon icon={Folder01Icon} className={`size-4 shrink-0 ${dropOn === f.id ? 'text-primary' : 'text-foreground/45'}`} strokeWidth={1.6} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{f.name}</span>
                      <span className="block text-[11px] text-foreground/40">{count(f.id)} image{count(f.id) === 1 ? '' : 's'}</span>
                    </span>
                  </button>
                </ContextActions>
              ))}
            </div>
          ) : null}
          {list.length > 0 && <p className="px-3 pt-1 text-[11px] font-medium tracking-[0.02em] text-foreground/45">Images</p>}
        </div>
      )}

      {!list.length && !working.some((w) => w.folder === folder) ? (
        <p className="px-3 py-6 text-center text-foreground/45">{here ? 'Empty folder.' : whose === 'mine' ? 'Nothing here yet.' : 'Nothing from the team yet.'}</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-2 gap-y-3 px-3">
          {whose === 'mine' && working.filter((w) => w.folder === folder).map((w) => (
            <div key={w.key} className="min-w-0">
              <span className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-md bg-foreground/[0.04] text-foreground/45 ring-1 ring-foreground/[0.06]">
                <HugeiconsIcon icon={SparklesIcon} className="size-4 animate-pulse text-primary" />
                Working…
              </span>
              <span className="mt-1 block truncate">{w.label}</span>
            </div>
          ))}
          {list.map(tile)}
        </div>
      )}

      <AssetViewer list={list} id={viewing} onId={(id) => { if (!id) followJob(null); setViewing(id); }} actions={(a) => actions(a, true)}
        working={working.find((w) => w.key === viewerJob)?.label ?? null} onJob={() => { fromViewer.current = true; }} />
      <AiDialog state={ai} onClose={() => setAi(null)} onRun={(prompt, ratio) => {
        const from = ai?.from ?? null;
        setAi(null);
        job(from ? `${from.name} · edited` : prompt, () => post('/api/assets/generate', { prompt, ratio, from: from?.id, ...(from ? {} : { folder }) }), from ? from.folderId : folder);
      }} />
      <PixelBackgroundDialog asset={pixelBg} onClose={() => setPixelBg(null)} onSave={(palette, size) => {
        const a = pixelBg!;
        const name = PALETTES.find((p) => p.key === palette)!.label.toLowerCase();
        setPixelBg(null);
        effect(a, `pixel background ${name}`, (src) => pixelBackground(src, `/api/assets/${a.id}/mask`, palette, size));
      }} />
      <NameDialog key={naming ? `name:${naming.title}:${naming.initial}` : 'name:none'} state={naming} onClose={() => setNaming(null)} />
      <ConfirmDialog state={confirming} onClose={() => setConfirming(null)} />
      <RenameDialog key={`rename:${renaming?.id ?? 'none'}`} asset={renaming} onClose={() => setRenaming(null)} onDone={(name) => {
        const a = renaming!;
        setRenaming(null);
        fetch(`/api/assets/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
          .then(async (r) => {
            if (r.ok) { rename(a.id, name); return; }
            const msg = (await r.json().catch(() => ({}))).error ?? 'Could not rename it.';
            if (/not found/i.test(msg)) { drop(a.id); toast('This image was removed.'); } else toast.error(msg);
          });
      }} />
    </div>
  );
}

// Generate an image, or edit one with instructions (Nano Banana through the Vercel AI Gateway).
function AiDialog({ state, onClose, onRun }: { state: { from: Asset | null } | null; onClose: () => void; onRun: (prompt: string, ratio: string) => void }) {
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('4:5');
  const editing = !!state?.from;
  const ideas = editing
    ? ['Put the background in a bright, modern dental office', 'Make the light warmer and softer', 'Remove the people in the background']
    : ['A bright, modern dental office reception, soft daylight, no people', 'Close-up of a dental chair and lamp, clean blue tones', 'A city skyline at dusk, wide, calm sky for text'];
  const run = () => { if (prompt.trim().length >= 3) { onRun(prompt.trim(), ratio); setPrompt(''); } };
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-4 rounded-md p-6 text-[13px] sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-medium">{editing ? `Edit “${state!.from!.name}” with AI` : 'Generate an image'}</DialogTitle>
          <DialogDescription className="text-[13px]">
            {editing ? 'Say what to change. The original stays as it is; the edit is a new image.' : 'Describe the place, object or scene. Photos of people from the team are uploaded, not generated.'}
          </DialogDescription>
        </DialogHeader>
        {editing && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state!.from!.thumb} alt="" className="h-28 w-full rounded-md bg-foreground/[0.04] object-contain" />
        )}
        <Textarea autoFocus value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder={ideas[0]}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); } }} className="resize-none text-[13px]" />
        <div className="flex flex-wrap gap-1">
          {ideas.map((i) => (
            <button key={i} type="button" onClick={() => setPrompt(i)} className="rounded-full bg-foreground/[0.05] px-2.5 py-1 text-[12px] text-foreground/65 hover:bg-foreground/[0.09] hover:text-foreground">{i}</button>
          ))}
        </div>
        {!editing && (
          <div className="grid grid-cols-4 gap-0.5 rounded-md bg-foreground/[0.05] p-0.5">
            {RATIOS.map(([r, name]) => (
              <button key={r} type="button" onClick={() => setRatio(r)}
                className={`h-8 rounded-[5px] text-[12px] ${ratio === r ? 'bg-background font-medium shadow-[0_0_0_1px_rgba(0,0,0,0.06)]' : 'text-foreground/55 hover:text-foreground'}`}>
                {name} <span className="text-foreground/40">{r}</span>
              </button>
            ))}
          </div>
        )}
        <button type="button" disabled={prompt.trim().length < 3} onClick={run}
          className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
          <HugeiconsIcon icon={AiMagicIcon} className="size-4" /> {editing ? 'Edit image' : 'Generate'}
        </button>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({ asset, onClose, onDone }: { asset: Asset | null; onClose: () => void; onDone: (name: string) => void }) {
  const [name, setName] = useState(asset?.name ?? '');
  const save = () => { const n = name.trim(); if (!n || n === asset?.name) onClose(); else onDone(n); };
  return (
    <Dialog open={!!asset} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="gap-4 rounded-md p-6 text-[13px] sm:max-w-[380px]">
        <DialogHeader><DialogTitle className="text-[15px] font-medium">Rename image</DialogTitle></DialogHeader>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          className="h-9 rounded-md bg-foreground/[0.04] px-3 outline-none focus:ring-1 focus:ring-primary/40" />
        <button type="button" onClick={save} className="h-9 rounded-md bg-primary font-medium text-primary-foreground hover:opacity-90">Save</button>
      </DialogContent>
    </Dialog>
  );
}

// Pixel background: the person stays as photographed; the place behind them turns into Archy's pixel
// tone in the blue chosen, so the person stands out. The person is separated once (remove background)
// and kept, so changing colours and sizes is instant.
function PixelBackgroundDialog({ asset, onClose, onSave }: { asset: Asset | null; onClose: () => void; onSave: (p: PaletteKey, s: PixelSize) => void }) {
  const [palette, setPalette] = useState<PaletteKey>('navy');
  const [size, setSize] = useState<PixelSize>('medium');
  const [images, setImages] = useState<{ photo: HTMLImageElement; mask: HTMLImageElement } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setImages(null); setError(null);
    if (!asset) return;
    let gone = false;
    (async () => {
      try {
        const res = await fetch(`/api/assets/${asset.id}/mask`);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not separate the person.');
        // The mask is ready (and cached): the images load from their own links.
        const [photo, mask] = await Promise.all([loadImage(`/api/assets/${asset.id}/file`), loadImage(`/api/assets/${asset.id}/mask`)]);
        if (!gone) setImages({ photo, mask });
      } catch (e) { if (!gone) setError((e as Error).message); }
    })();
    return () => { gone = true; };
  }, [asset]);

  // The preview, at a size that redraws at once.
  useEffect(() => {
    const out = preview.current;
    if (!images || !out) return;
    const cv = drawPixelBackground(images.photo, images.mask, palette, size, 720);
    out.width = cv.width; out.height = cv.height;
    out.getContext('2d')!.drawImage(cv, 0, 0);
  }, [images, palette, size]);

  return (
    <Dialog open={!!asset} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-4 rounded-md p-6 text-[13px] sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-medium">Pixel background</DialogTitle>
          <DialogDescription className="text-[13px]">The person stays as photographed; the place behind them turns into Archy’s pixel tone, in the blue you choose.</DialogDescription>
        </DialogHeader>
        <div className="flex h-[340px] items-center justify-center overflow-hidden rounded-md bg-foreground/[0.04]">
          {error ? <p className="px-6 text-center text-foreground/55">{error}</p>
            : !images ? (
              <p className="flex flex-col items-center gap-2 text-foreground/50">
                <HugeiconsIcon icon={SparklesIcon} className="size-5 animate-pulse text-primary" />
                Separating the person from the background…
              </p>
            ) : <canvas ref={preview} className="max-h-full max-w-full" />}
        </div>
        <div className="space-y-2">
          <p className="text-[12px] text-foreground/50">Background</p>
          <div className="flex flex-wrap gap-1.5">
            {PALETTES.map((p) => (
              <button key={p.key} type="button" onClick={() => setPalette(p.key)}
                className={`flex h-8 items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-[12px] ring-1 transition-colors ${palette === p.key ? 'bg-[#E6F4FF] font-medium text-primary ring-primary/50' : 'ring-foreground/10 hover:bg-foreground/[0.03]'}`}>
                <span className="size-6 rounded-full ring-1 ring-black/10" style={{ background: swatch(p.key) }} /> {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[12px] text-foreground/50">Pixel size</p>
          <div className="grid grid-cols-3 gap-0.5 rounded-md bg-foreground/[0.05] p-0.5">
            {PIXEL_SIZES.map((x) => (
              <button key={x.key} type="button" onClick={() => setSize(x.key)}
                className={`h-8 rounded-[5px] text-[12px] ${size === x.key ? 'bg-background font-medium shadow-[0_0_0_1px_rgba(0,0,0,0.06)]' : 'text-foreground/55 hover:text-foreground'}`}>{x.label}</button>
            ))}
          </div>
        </div>
        <button type="button" disabled={!images} onClick={() => onSave(palette, size)}
          className="flex h-9 items-center justify-center rounded-md bg-primary font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">Save as a new image</button>
      </DialogContent>
    </Dialog>
  );
}

// One image, large: the full file on a checkerboard (transparency shows), click to see it at 100%, its
// details beside it and everything that can be done with it. ← → move through the list, Esc closes.
function AssetViewer({ list, id, onId, actions, working, onJob }: {
  list: Asset[]; id: string | null; onId: (id: string | null) => void; actions: (a: Asset) => Action[];
  /** A job running (its label): shown over the image, whose result replaces it here. */
  working: string | null; onJob: () => void;
}) {
  const i = list.findIndex((a) => a.id === id);
  const a = i >= 0 ? list[i] : null;
  const [actual, setActual] = useState(false);
  // Per image, so a cached image that loads at once is never hidden by a later reset.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const loaded = !!a && loadedId === a.id, failed = !!a && failedId === a.id;
  useEffect(() => { setActual(false); }, [id]);
  const go = (d: number) => { if (list.length) onId(list[(i + d + list.length) % list.length].id); };
  useEffect(() => {
    if (!a) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea') || actual) return; // at actual size, arrows scroll
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  // Effects run here (the view waits for the result and then shows it); actions with their own dialog
  // (pixel background, edit with AI, rename) or that place the image close the view.
  const OWN_DIALOG = /…$|^Use in the design$|^Remove from Assets$/;
  const run = (f?: () => void, label = '') => () => {
    if (OWN_DIALOG.test(label)) onId(null); else onJob();
    f?.();
  };
  const when = a ? new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onId(null)}>
      <DialogContent className="flex h-[88vh] w-[92vw] max-w-[1400px] gap-0 overflow-hidden rounded-md p-0 text-[13px] sm:max-w-[1400px]">
        {a && (
          <>
            <div className={`relative min-w-0 flex-1 bg-[repeating-conic-gradient(#efefef_0_25%,#fff_0_50%)] bg-[length:16px_16px] ${actual ? 'overflow-auto' : 'flex items-center justify-center overflow-hidden p-6'}`}>
              {/* While the full file arrives (or if it cannot): the thumbnail, sharp, at the size the image will have. */}
              {!loaded && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.thumb} alt="" aria-hidden className="absolute inset-6 h-[calc(100%-48px)] w-[calc(100%-48px)] object-contain" />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={a.id} src={`/api/assets/${a.id}/file`} alt={a.name} onLoad={() => setLoadedId(a.id)} onError={() => setFailedId(a.id)} onClick={() => setActual((v) => !v)}
                className={`relative transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'} ${actual ? 'max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in object-contain'}`} />
              {!loaded && (
                <span className="absolute top-3 left-1/2 z-[1] -translate-x-1/2 rounded-full bg-background/90 px-3 py-1 text-[12px] text-foreground/65 shadow-sm">
                  {failed ? 'This image is no longer available.' : 'Loading full size…'}
                </span>
              )}
              {list.length > 1 && (
                <>
                  <button type="button" aria-label="Previous image" onClick={() => go(-1)} className="absolute top-1/2 left-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-md hover:bg-background">
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                  </button>
                  <button type="button" aria-label="Next image" onClick={() => go(1)} className="absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-md hover:bg-background">
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                  </button>
                </>
              )}
              {working && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-[2px]">
                  <HugeiconsIcon icon={SparklesIcon} className="size-6 animate-pulse text-primary" />
                  <p className="font-medium">Working…</p>
                  <p className="max-w-[60%] truncate text-foreground/55">{working}</p>
                </div>
              )}
              <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground/70 px-2.5 py-1 text-[11px] text-background">
                {!loaded ? 'Preview' : actual ? 'Actual size · click to fit' : 'Click to see it at actual size'}
              </span>
            </div>
            <aside className="flex w-[280px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-foreground/[0.06] p-5">
              <div className="space-y-1 pr-6">
                <DialogTitle className="text-[15px] leading-snug font-medium break-words">{a.name}</DialogTitle>
                <DialogDescription className="text-[12px] text-foreground/50">{KIND[a.kind]}{a.width && a.height ? ` · ${a.width}×${a.height}` : ''}</DialogDescription>
                <p className="text-[12px] text-foreground/50">Added by {a.author} · {when}</p>
              </div>
              {a.prompt && <p className="rounded-md bg-foreground/[0.04] p-3 text-[12px] text-foreground/70">“{a.prompt}”</p>}
              <div className="space-y-1">
                {actions(a).map((x, k) => {
                  if ('separator' in x) return <div key={k} className="my-2 h-px bg-foreground/[0.06]" />;
                  if (x.items) return (
                    <div key={x.label} className="flex items-center gap-2 py-1">
                      {x.icon && <HugeiconsIcon icon={x.icon} className="size-4 shrink-0 text-foreground/45" strokeWidth={1.6} />}
                      <span className="flex-1">{x.label}</span>
                      {x.items.map((y) => 'separator' in y ? null : (
                        <button key={y.label} type="button" disabled={!!working} onClick={run(y.onSelect, y.label)} className="h-7 rounded-md bg-foreground/[0.05] px-2.5 text-[12px] hover:bg-[#E6F4FF] hover:text-primary disabled:opacity-40">{y.label}</button>
                      ))}
                    </div>
                  );
                  return (
                    <button key={x.label} type="button" disabled={!!working && !OWN_DIALOG.test(x.label)} onClick={run(x.onSelect, x.label)}
                      className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-foreground/[0.04] disabled:opacity-40 ${x.destructive ? 'text-destructive' : ''}`}>
                      {x.icon && <HugeiconsIcon icon={x.icon} className="size-4 shrink-0 text-foreground/45" strokeWidth={1.6} />}
                      {x.label}
                    </button>
                  );
                })}
                <a href={`/api/assets/${a.id}/file?download=1`} className="flex h-8 w-full items-center gap-2 rounded-md px-2 hover:bg-foreground/[0.04]">
                  <HugeiconsIcon icon={Download04Icon} className="size-4 shrink-0 text-foreground/45" strokeWidth={1.6} /> Download
                </a>
              </div>
              {list.length > 1 && <p className="mt-auto text-[11px] text-foreground/35">{i + 1} of {list.length} · ← → to move</p>}
            </aside>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// A name for something (a new folder, a folder renamed).
function NameDialog({ state, onClose }: { state: { title: string; action: string; initial: string; done: (name: string) => void } | null; onClose: () => void }) {
  const [name, setName] = useState(state?.initial ?? '');
  const save = () => { const n = name.trim(); if (!n || n === state?.initial) { onClose(); return; } state!.done(n); onClose(); };
  return (
    <Dialog open={!!state} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="gap-4 rounded-md p-6 text-[13px] sm:max-w-[380px]">
        <DialogHeader><DialogTitle className="text-[15px] font-medium">{state?.title}</DialogTitle></DialogHeader>
        <input autoFocus value={name} placeholder="Speakers, Partner logos…" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          className="h-9 rounded-md bg-foreground/[0.04] px-3 outline-none focus:ring-1 focus:ring-primary/40" />
        <button type="button" disabled={!name.trim()} onClick={save} className="h-9 rounded-md bg-primary font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">{state?.action}</button>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDialog({ state, onClose }: { state: { title: string; text: string; action: string; done: () => void } | null; onClose: () => void }) {
  return (
    <Dialog open={!!state} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="gap-4 rounded-md p-6 text-[13px] sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-medium">{state?.title}</DialogTitle>
          <DialogDescription className="text-[13px]">{state?.text}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-md bg-foreground/[0.05] hover:bg-foreground/[0.09]">Cancel</button>
          <button type="button" onClick={() => { state?.done(); onClose(); }} className="h-9 rounded-md bg-destructive font-medium text-white hover:opacity-90">{state?.action}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
