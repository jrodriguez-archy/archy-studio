import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CanvasEditor } from '@/components/canvas/editor';
import { canReplace, canvasLibrary, editorContext, isNew, loadSource } from '@/lib/canvas';
import { titleFromSlots } from '@/lib/gallery-shared';
import { getDraft } from '@/lib/canvas-claude';
import { prepareFill } from '@/lib/renderer';

// A piece (or a new one from a template) in Canvas, with the panel's library.
export async function OpenPiece({ pieceRef, me }: { pieceRef: string; me: { id: string; is_admin: boolean } }) {
  const piece = await loadSource(pieceRef);
  if (!piece) notFound();
  const fresh = isNew(piece);
  const back = fresh ? '/templates' : `/?all=1&set=${piece.set_id ?? piece.id}`;
  // Pieces made before Canvas lost inline logos ('[inline image]'): they cannot be drawn again.
  // Work in progress (by hand or by Claude) picks up where it was left.
  const draft = fresh ? null : await getDraft(piece.id);
  const lost = Object.entries(draft?.slots ?? piece.slots).filter(([, v]) => v === '[inline image]').map(([k]) => k);
  if (lost.length) return <CannotOpen back={back} text={`Its ${lost.join(', ')} was sent inline before Canvas existed and was not kept. Ask Claude for a new version with the logo, then open that one.`} />;
  let ready;
  try {
    ready = await Promise.all([
      editorContext(piece),
      prepareFill({ template: piece.template, format: piece.format, slots: draft?.slots ?? piece.slots, edits: draft?.edits ?? piece.edits }, '/api/template-files'),
      prepareFill({ template: piece.template, format: piece.format, slots: piece.slots, edits: piece.edits }, '/api/template-files').then((p) => p.slots),
      canReplace(me, piece),
      canvasLibrary(me),
    ]);
  } catch (e) {
    return <CannotOpen back={back} text={(e as Error).message} />;
  }
  const [ctx, plan, savedSlots, replace, library] = ready;
  return (
    <CanvasEditor
      library={library}
      piece={{
        pieceId: piece.id, isNew: fresh, canReplace: replace, backHref: back, formatLabel: ctx.formatLabel,
        title: fresh ? ctx.title : piece.set_title ?? titleFromSlots(piece.slots) ?? ctx.title,
        initial: { slots: plan.slots, edits: draft?.edits ?? piece.edits }, saved: { slots: savedSlots, edits: piece.edits },
        draft: draft ? { version: draft.version, by: draft.updated_by, note: draft.note } : null, plan, slotMeta: ctx.slots,
      }}
    />
  );
}

function CannotOpen({ back, text }: { back: string; text: string }) {
  return (
    <div data-fullbleed className="flex min-h-dvh items-center justify-center bg-[#F5F5F5] p-6 text-[13px]">
      <div className="max-w-sm space-y-3 rounded-lg bg-background p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
        <p className="text-[15px] font-medium">This piece can’t open in Canvas</p>
        <p className="text-foreground/60">{text}</p>
        <Link href={back} className="inline-flex h-8 items-center rounded-md bg-foreground/[0.05] px-3 hover:bg-foreground/[0.09]">Go back</Link>
      </div>
    </div>
  );
}
