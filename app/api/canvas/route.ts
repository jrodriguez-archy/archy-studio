import { revalidatePath } from 'next/cache';
import { isNew, loadSource } from '@/lib/canvas';
import { exportEdited, saveEdited, saveSet } from '@/lib/canvas-render';
import { clearDraft } from '@/lib/drafts';
import { currentUser } from '@/lib/team';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Canvas export and save: render the edited piece at 2x with Chromium. Its own function, so the
// Canvas page does not carry the browser.
// POST { action: 'export' | 'save', id, slots, edits, mode? }
//      { action: 'save-set', items: [{ id, slots, edits }], mode, from? }: every artboard that changed
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return Response.json({ ok: false, error: 'Sign in again.' }, { status: 401 });
  const body = await req.json().catch(() => null);
  try {
    if (body?.action === 'save-set') {
      const list = Array.isArray(body.items) ? body.items.slice(0, 8) : [];
      const items = await Promise.all(list.map(async (i: { id: string; slots?: Record<string, string | null>; edits?: Record<string, unknown> }) => {
        const piece = await loadSource(String(i.id));
        if (!piece) throw new Error('Design not found.');
        return { piece, slots: i.slots ?? {}, edits: i.edits ?? {} };
      }));
      if (!items.length) throw new Error('Nothing to save.');
      const from = body.from ? await loadSource(String(body.from)) : null;
      const saved = await saveSet(me, items, body.mode === 'replace' ? 'replace' : 'version', from);
      await Promise.all(items.filter((i) => !isNew(i.piece)).map((i) => clearDraft(i.piece.id)));
      revalidatePath('/', 'layout');
      return Response.json({ ok: true, saved: saved.map((s) => ({ ref: s.ref, id: s.id })) });
    }
    const piece = body?.id ? await loadSource(String(body.id)) : null;
    if (!piece) throw new Error('Design not found.');
    if (body.action === 'export') return Response.json({ ok: true, url: await exportEdited(piece, body.slots ?? {}, body.edits ?? {}) });
    if (body.action === 'save') {
      const saved = await saveEdited(me, piece, body.slots ?? {}, body.edits ?? {}, body.mode === 'replace' ? 'replace' : 'version');
      if (!isNew(piece)) await clearDraft(piece.id);
      revalidatePath('/', 'layout');
      return Response.json({ ok: true, id: saved.id, url: saved.url });
    }
    throw new Error('Unknown action.');
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
