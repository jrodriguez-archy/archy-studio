import { libraryAction, prepareAction, saveDraftAction } from '@/app/(app)/canvas/actions';

export const runtime = 'nodejs';

// Canvas's light calls (a format's fill, its draft, the panel's library) as one route: unlike server
// actions, which a page runs one at a time, these run side by side, so a fill never waits behind the
// library or another format's draft.
// POST { kind: 'prepare' | 'draft' | 'library', args: [...] } — the same arguments as the actions.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { kind?: string; args?: unknown[] } | null;
  const a = (body?.args ?? []) as unknown;
  try {
    switch (body?.kind) {
      case 'prepare': return Response.json(await prepareAction(...(a as Parameters<typeof prepareAction>)));
      case 'draft': return Response.json(await saveDraftAction(...(a as Parameters<typeof saveDraftAction>)));
      case 'library': return Response.json(await libraryAction());
      default: return Response.json({ ok: false, error: 'Unknown call.' }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message || 'Something went wrong. Try again.' }, { status: 500 });
  }
}
