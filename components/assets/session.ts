import type { Asset, Folder } from '@/lib/assets';

export type Lists = { mine: Asset[]; team: Asset[] };
export const RATIOS = [['4:5', 'Post'], ['1:1', 'Square'], ['9:16', 'Story'], ['16:9', 'Wide']] as const;
export const KIND: Record<Asset['kind'], string> = { upload: 'Upload', cutout: 'Cutout', pixel: 'Pixel effect', generated: 'Generated' };

// What this browser session changed (new images, renames, removals, folders and moves), kept across tab
// switches and the library's live reloads, which bring the server's list again.
export const session = {
  added: [] as Asset[], gone: new Set<string>(), names: new Map<string, string>(), folderOf: new Map<string, string | null>(),
  folders: [] as Folder[], foldersGone: new Set<string>(), folderNames: new Map<string, string>(),
  /** Images moved in (+) or out (−) of each folder this session, on top of the server's counts. */
  counts: new Map<string, number>(),
};
export const bump = (id: string | null | undefined, by: number) => { if (id) session.counts.set(id, (session.counts.get(id) ?? 0) + by); };
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
let countedOn: Folder[] | null = null;
export function foldersWithSession(base: Folder[]): Folder[] {
  // Fresh counts from the server already hold this session's moves and uploads.
  if (base && base !== countedOn) { if (countedOn) session.counts.clear(); countedOn = base; }
  const seen = new Set<string>();
  // Folders made here that the server now lists come from the server (so a removal elsewhere shows).
  session.folders = session.folders.filter((f) => !(base ?? []).some((b) => b.id === f.id));
  return [...(base ?? []), ...session.folders]
    .filter((f) => !session.foldersGone.has(f.id) && !seen.has(f.id) && !!seen.add(f.id))
    .map((f) => ({ ...f, count: Math.max(0, f.count + (session.counts.get(f.id) ?? 0)), ...(session.folderNames.has(f.id) ? { name: session.folderNames.get(f.id)! } : {}) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
