'use client';

import { zipSync } from 'fflate';
import { toast } from 'sonner';

// Every format of a set as one ZIP, made in the browser: the PNGs come side by side straight from
// storage (signed links from /api/sets/<id>/zip?list=1). Falls back to the server's ZIP if that fails.
export async function downloadSet(id: string) {
  const t = toast.loading('Preparing the ZIP…');
  try {
    const r = await fetch(`/api/sets/${id}/zip?list=1`);
    if (!r.ok) throw new Error();
    const { name, files } = (await r.json()) as { name: string; files: { name: string; url: string }[] };
    const parts = await Promise.all(files.map(async (f) => [f.name, new Uint8Array(await (await fetch(f.url)).arrayBuffer())] as const));
    const zip = zipSync(Object.fromEntries(parts.map(([n, b]) => [n, [b, { level: 0 }]])));
    const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast.dismiss(t);
  } catch {
    toast.dismiss(t);
    window.location.href = `/api/sets/${id}/zip`;
  }
}
