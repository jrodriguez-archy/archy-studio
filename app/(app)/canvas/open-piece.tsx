import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CanvasEditor, type Board } from '@/components/canvas/editor';
import { canReplace, editorContext, isNew, loadSet, loadSource, type PieceSource } from '@/lib/canvas';
import { markOnboarding } from '@/lib/onboarding';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { formatLabel, titleFromSlots } from '@/lib/gallery-shared';
import { getDraft, type AddedFormat } from '@/lib/drafts';
import { prepareFill } from '@/lib/fill';

type Who = { id: string; is_admin: boolean };

// A piece (or a new one from a template) in Canvas, with the other formats of its set as artboards.
// The panel's library loads afterwards, in the browser.
export async function OpenPiece({ pieceRef, me }: { pieceRef: string; me: Who }) {
  const piece = await loadSource(pieceRef);
  if (!piece) notFound();
  const fresh = isNew(piece);
  const back = fresh ? '/templates' : `/?all=1&set=${piece.set_id ?? piece.id}`;
  let ready;
  try {
    const [set, ctx, seenAt] = await Promise.all([
      loadSet(piece),
      editorContext(piece),
      supabaseAdmin().from('profiles').select('mcp_seen_at').eq('id', me.id).maybeSingle().then((r) => (r.data?.mcp_seen_at as string | null | undefined) ?? null),
      // "Open it in Canvas", the Gallery's last Get started step (once).
      fresh ? null : markOnboarding(me, 'canvas_at').catch(() => {}),
    ]);
    const opened = await Promise.all(set.pieces.map((p) => openBoard(p, me)));
    // Formats added and not saved yet (kept with the work in progress): back as new artboards.
    const added = new Map<string, AddedFormat>();
    for (const b of opened) for (const a of ('added' in b ? b.added : [])) added.set(a.ref, a);
    const missing = set.missing.filter((m) => !added.has(m.ref));
    const extra = await Promise.all([...added.values()].filter((a) => set.missing.some((m) => m.ref === a.ref)).map(async (a) => {
      const p = await loadSource(a.ref);
      return p ? openBoard(p, me, a) : null;
    }));
    const boards = [...opened, ...extra.filter((b) => b !== null)].map((b) => ('lost' in b ? b : b.board));
    ready = { set: { ...set, missing }, ctx, seenAt, boards };
  } catch (e) {
    return <CannotOpen back={back} text={(e as Error).message} />;
  }
  const { set, ctx, seenAt, boards } = ready;
  const mine = boards[set.pieces.findIndex((p) => p.id === piece.id)] ?? boards[0];
  if ('lost' in mine) return <CannotOpen back={back} text={mine.lost} />;
  return (
    <CanvasEditor
      seenAt={seenAt}
      piece={{
        // The design and theme follow the title on templates that offer several ("AE Spotlight · The Arch, Navy").
        title: (fresh ? ctx.title : piece.set_title ?? titleFromSlots(piece.slots) ?? ctx.title) + (ctx.combo ? ` · ${ctx.combo.designLabel}, ${ctx.combo.themeLabel}` : ''),
        backHref: back, active: piece.id,
        // Formats that cannot be drawn again stay out (they keep their image in the gallery).
        boards: boards.filter((b): b is Board => !('lost' in b)),
        ghosts: set.missing.map((m) => ({ ...m, label: formatLabel(m.format) })),
        slotMeta: ctx.slotsByFormat,
        brand: ctx.brand,
      }}
    />
  );
}

// One format as an artboard: its draft if someone was working on it, its fill, what was saved, and the
// formats added to the set and not saved yet (on its draft). `given`: an added format's kept content.
async function openBoard(piece: PieceSource, me: Who, given?: AddedFormat): Promise<{ board: Board; added: AddedFormat[] } | { lost: string }> {
  const fresh = isNew(piece);
  const draft = fresh ? (given ? { slots: given.slots, edits: given.edits, version: 0, updated_by: 'app', note: null, added: [] } : null) : await getDraft(piece.id);
  // Pieces made before Canvas lost inline logos ('[inline image]'): they cannot be drawn again.
  const lost = Object.entries(draft?.slots ?? piece.slots).filter(([, v]) => v === '[inline image]').map(([k]) => k);
  if (lost.length) return { lost: `Its ${lost.join(', ')} was sent inline before Canvas existed and was not kept. Ask Claude for a new version with the logo, then open that one.` };
  // Work in progress (by hand or by Claude) picks up where it was left.
  // Without a draft, what is open is what was saved: one fill for both.
  const fill = (slots: PieceSource['slots'], edits: PieceSource['edits'], slotsOnly = false) => prepareFill({ template: piece.template, format: piece.format, design: piece.design, theme: piece.theme, smallerText: !!piece.smaller_text, slots, edits }, '/api/template-files', slotsOnly);
  const [plan, savedSlots, replace] = await Promise.all([
    draft ? fill(draft.slots, draft.edits) : fill(piece.slots, piece.edits),
    draft ? fill(piece.slots, piece.edits, true).then((p) => p.slots) : null,
    canReplace(me, piece),
  ]);
  const board: Board = {
    ref: piece.id, format: piece.format, label: formatLabel(piece.format), width: piece.width, height: piece.height, isNew: fresh, canReplace: replace,
    initial: { slots: plan.slots, edits: draft?.edits ?? piece.edits }, saved: { slots: savedSlots ?? plan.slots, edits: piece.edits }, plan,
    draft: draft && !fresh ? { version: draft.version, by: draft.updated_by, note: draft.note } : null,
  };
  return { board, added: (!fresh && draft?.added) || [] };
}

function CannotOpen({ back, text }: { back: string; text: string }) {
  return (
    <div data-fullbleed className="flex min-h-dvh items-center justify-center bg-[#F5F5F5] p-6 text-[13px]">
      <div className="max-w-sm space-y-3 rounded-lg bg-background p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
        <p className="text-[15px] font-medium">This design can’t open in Canvas</p>
        <p className="text-foreground/60">{text}</p>
        <Link href={back} className="inline-flex h-8 items-center rounded-md bg-foreground/[0.05] px-3 hover:bg-foreground/[0.09]">Go back</Link>
      </div>
    </div>
  );
}
