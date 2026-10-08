'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DashboardSquare01Icon, Delete02Icon, Folder01Icon, FolderAddIcon, FolderExportIcon, GridIcon, ImageUploadIcon,
  MagicWand01Icon, PaintBoardIcon, PencilEdit02Icon, Scissor01Icon, UserIcon, ZoomInAreaIcon,
} from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import type { Action } from '@/components/action-menu';
import type { Asset, Folder } from '@/lib/assets';
import { PALETTES, pixelBackground, pixelDissolve, pixelTone, type Tone } from '@/lib/pixel-effects';
import { AiDialog, AssetViewer, ConfirmDialog, NameDialog, PixelBackgroundDialog, RenameDialog } from './dialogs';
import { MAX_UPLOAD, bump, foldersWithSession, session, withSession, type Lists } from './session';

/** Where the list is: one folder, the images in no folder (null), or every image ('all', the page only). */
export type Place = string | null | 'all';

// The team's images and everything that can be done with them, shared by the Assets page and the
// Canvas panel: one library, so what happens in one shows in the other. `target`/`onPick`: the photo
// or logo selected on a design (Canvas), where a click places an image.
export function useAssetLibrary({ assets, folders: baseFolders, target = null, onPick = () => {}, start = null, onUseInDesign }: {
  assets: Lists; folders: Folder[]; target?: string | null; onPick?: (value: string) => void; start?: Place;
  /** The page offers "Use in a design…" (Canvas does not need it). */
  onUseInDesign?: (a: Asset) => void;
}) {
  const [tick, setTick] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lists = useMemo(() => withSession(assets), [assets, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const folders = useMemo(() => foldersWithSession(baseFolders), [baseFolders, tick]);
  const [folder, setFolder] = useState<Place>(start);
  const here = folder && folder !== 'all' ? folders.find((f) => f.id === folder) ?? null : null;
  useEffect(() => { if (folder && folder !== 'all' && !here) setFolder(start); }, [folder, here, start]);
  const [whose, setWhose] = useState<'mine' | 'team'>('mine');
  const [kind, setKind] = useState<Asset['kind'] | null>(null);
  // Several images picked (⌘/Shift-click) to move or remove together.
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => setPicked([]), [folder, whose, kind]);
  const [naming, setNaming] = useState<{ title: string; action: string; initial: string; done: (name: string) => void } | null>(null);
  const [confirming, setConfirming] = useState<{ title: string; text: string; action: string; done: () => void } | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const [working, setWorking] = useState<{ key: string; label: string; folder: Place }[]>([]);
  const [ai, setAi] = useState<{ from: Asset | null } | null>(null);
  const [renaming, setRenaming] = useState<Asset | null>(null);
  const [pixelBg, setPixelBg] = useState<Asset | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  // A folder's own images, from the server (all of them, not only the newest loaded with the page).
  const [inFolder, setInFolder] = useState<Record<string, Lists>>({});
  useEffect(() => {
    if (!folder || folder === 'all') return;
    let gone = false;
    Promise.all([fetch(`/api/assets?folder=${folder}`), fetch(`/api/assets?folder=${folder}&whose=mine`)])
      .then(async ([t, m]) => (t.ok && m.ok ? { team: (await t.json()).assets as Asset[], mine: (await m.json()).assets as Asset[] } : null))
      .then((l) => { if (l && !gone) setInFolder((x) => ({ ...x, [folder]: l })); })
      .catch(() => {});
    return () => { gone = true; };
  }, [folder]);

  // Search by name, in the database (older images too), shortly after typing stops.
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Lists | null>(null);
  useEffect(() => {
    const q = query.trim();
    if (!q) { setFound(null); return; }
    let gone = false;
    const t = setTimeout(() => {
      Promise.all([fetch(`/api/assets?search=${encodeURIComponent(q)}`), fetch(`/api/assets?search=${encodeURIComponent(q)}&whose=mine`)])
        .then(async ([a, b]) => (a.ok && b.ok ? { team: (await a.json()).assets as Asset[], mine: (await b.json()).assets as Asset[] } : null))
        .then((l) => { if (l && !gone) setFound(l); })
        .catch(() => {});
    }, 250);
    return () => { gone = true; clearTimeout(t); };
  }, [query]);

  // What is on screen: a search, a folder (what the server holds there plus this session's changes), or all.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const source = useMemo(() => {
    if (found) return withSession({ mine: found.mine, team: found.team });
    if (folder && folder !== 'all' && inFolder[folder]) return withSession({ mine: [...inFolder[folder].mine, ...assets.mine], team: [...inFolder[folder].team, ...assets.team] });
    return lists;
  }, [found, folder, inFolder, lists, assets]);
  const mineIds = new Set([...lists.mine, ...source.mine].map((a) => a.id));
  const q = query.trim().toLowerCase();
  const list = (whose === 'mine' ? source.mine : source.team)
    .filter((a) => (found ? a.name.toLowerCase().includes(q) : folder === 'all' || (a.folderId ?? null) === folder))
    .filter((a) => !kind || a.kind === kind);
  // Picked images that are still on screen (a removed one drops out).
  const shownPicked = picked.filter((id) => list.some((a) => a.id === id));
  const count = (id: string) => folders.find((f) => f.id === id)?.count ?? 0;
  const find = (id: string) => [...source.team, ...source.mine, ...lists.team, ...lists.mine].find((a) => a.id === id) ?? null;

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
    if (folder === id) setFolder(start);
    setTick((t) => t + 1);
    toast('This folder was deleted.');
  };
  const move = async (ids: string[], to: string | null, toName?: string) => {
    const was = new Map(ids.map((id) => [id, find(id)?.folderId ?? null]));
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
        try { await json(`/api/assets/folders/${f.id}`, 'DELETE'); session.foldersGone.add(f.id); if (folder === f.id) setFolder(start); setTick((t) => t + 1); }
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
    bump(find(id)?.folderId, -1);
    session.gone.add(id); setPicked((p) => p.filter((x) => x !== id)); setTick((t) => t + 1);
  };
  const rename = (id: string, name: string) => { session.names.set(id, name); setTick((t) => t + 1); };

  // ---- Jobs: each shows a placeholder until its image arrives, then joins Mine (and Team) ----
  // A job started from the large view: the view follows that one job and shows its result.
  const fromViewer = useRef(false);
  const [viewerJob, setViewerJob] = useState<string | null>(null);
  const viewerJobRef = useRef<string | null>(null);
  const followJob = (key: string | null) => { viewerJobRef.current = key; setViewerJob(key); };
  // The newest result of a job, for whoever wants to show it (the page's detail panel).
  const [lastMade, setLastMade] = useState<Asset | null>(null);
  // Where new things land: the folder open (in "All images" or a search: no folder).
  const landing = folder && folder !== 'all' && !found ? folder : null;

  // `into`: the folder the result lands in (its placeholder shows there only).
  const job = async (label: string, run: () => Promise<Asset>, into: string | null = landing) => {
    const key = Math.random().toString(36).slice(2);
    setWorking((w) => [{ key, label, folder: into }, ...w]);
    if (fromViewer.current) { fromViewer.current = false; followJob(key); } else setWhose('mine');
    try {
      const a = await run();
      add(a);
      setLastMade(a);
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
  const post = async (url: string, body?: unknown) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Try again.');
    return data.asset as Asset;
  };

  const upload = (file: File, into: string | null = landing, place = true) => {
    if (file.size > MAX_UPLOAD) { toast.error(`${file.name} is larger than 4 MB. Export it smaller and try again.`); return Promise.resolve(); }
    return job(file.name.replace(/\.\w+$/, ''), async () => {
      const body = new FormData();
      body.set('file', file);
      if (into) body.set('folder', into);
      const a = await send(body);
      if (place && target) onPick(a.value);
      return a;
    }, into);
  };
  // Several files (picked or dropped from the desktop): three at a time.
  const uploadMany = async (files: File[], into: string | null = landing) => {
    const images = files.filter((f) => /^image\/(png|jpeg|webp|svg\+xml)$/.test(f.type));
    if (images.length < files.length) toast(`${files.length - images.length} file${files.length - images.length > 1 ? 's are' : ' is'} not an image (PNG, JPG, WebP or SVG).`);
    const queue = [...images];
    await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
      for (let f = queue.shift(); f; f = queue.shift()) await upload(f, into, images.length === 1);
    }));
  };

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
    ...(onUseInDesign ? [{ label: 'Use in a design…', icon: PaintBoardIcon, onSelect: () => onUseInDesign(a) }, { separator: true } as const] : []),
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

  // Rename in place (the page's detail panel), with the same outcome as the dialog.
  const renameTo = (a: Asset, name: string) => {
    const n = name.trim();
    if (!n || n === a.name) return;
    rename(a.id, n);
    fetch(`/api/assets/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n }) })
      .then(async (r) => {
        if (r.ok) return;
        const msg = (await r.json().catch(() => ({}))).error ?? 'Could not rename it.';
        rename(a.id, a.name);
        if (/not found/i.test(msg)) { drop(a.id); toast('This image was removed.'); } else toast.error(msg);
      });
  };

  const dialogs = (
    <>
      <AssetViewer list={list} id={viewing} onId={(id) => { if (!id) followJob(null); setViewing(id); }} actions={(a) => actions(a, true)}
        working={working.find((w) => w.key === viewerJob)?.label ?? null} onJob={() => { fromViewer.current = true; }} />
      <AiDialog state={ai} onClose={() => setAi(null)} onRun={(prompt, ratio) => {
        const from = ai?.from ?? null;
        setAi(null);
        job(from ? `${from.name} · edited` : prompt, () => post('/api/assets/generate', { prompt, ratio, from: from?.id, ...(from ? {} : { folder: landing }) }), from ? from.folderId : landing);
      }} />
      <PixelBackgroundDialog asset={pixelBg} onClose={() => setPixelBg(null)} onSave={(palette, size) => {
        const a = pixelBg!;
        const name = PALETTES.find((p) => p.key === palette)!.label.toLowerCase();
        setPixelBg(null);
        effect(a, `pixel background ${name}`, (src) => pixelBackground(src, `/api/assets/${a.id}/mask`, palette, size));
      }} />
      <NameDialog key={naming ? `name:${naming.title}:${naming.initial}` : 'name:none'} state={naming} onClose={() => setNaming(null)} />
      <ConfirmDialog state={confirming} onClose={() => setConfirming(null)} />
      <RenameDialog key={`rename:${renaming?.id ?? 'none'}`} asset={renaming} onClose={() => setRenaming(null)} onDone={(name) => { const a = renaming!; setRenaming(null); renameTo(a, name); }} />
    </>
  );

  return {
    target, onPick, lists, folders, folder, setFolder, here, whose, setWhose, kind, setKind, query, setQuery, searching: !!found,
    list, picked, setPicked, shownPicked, working, viewing, setViewing, dropOn, setDropOn, count, mineIds, landing, lastMade, find,
    actions, folderActions, moveItems, move, newFolder, upload, uploadMany, renameTo, generate: () => setAi({ from: null }), dialogs,
  };
}
export type AssetLibrary = ReturnType<typeof useAssetLibrary>;
