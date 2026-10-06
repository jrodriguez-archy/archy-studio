import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CanvasEditor } from '@/components/canvas/editor';
import { canReplace, editorContext, loadSource } from '@/lib/canvas';
import { titleFromSlots } from '@/lib/gallery-shared';
import { prepareFill } from '@/lib/renderer';
import { currentUser } from '@/lib/team';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const piece = await loadSource((await params).id);
  return { title: `${piece ? piece.set_title ?? titleFromSlots(piece.slots) ?? 'Canvas' : 'Canvas'} · Archy Studio` };
}

export default async function CanvasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentUser();
  if (!me) redirect(`/login?next=/canvas/${id}`);
  const piece = await loadSource(id);
  if (!piece) notFound();
  const back = `/?all=1&set=${piece.set_id ?? piece.id}`;
  // Pieces made before Canvas lost inline logos ('[inline image]'): they cannot be drawn again.
  const lost = Object.entries(piece.slots).filter(([, v]) => v === '[inline image]').map(([k]) => k);
  if (lost.length) return <CannotOpen back={back} text={`Its ${lost.join(', ')} was sent inline before Canvas existed and was not kept. Ask Claude for a new version with the logo, then open that one.`} />;
  let ready;
  try {
    ready = await Promise.all([
      editorContext(piece),
      prepareFill({ template: piece.template, format: piece.format, slots: piece.slots, edits: piece.edits }, '/api/template-files'),
      canReplace(me, piece),
    ]);
  } catch (e) {
    return <CannotOpen back={back} text={(e as Error).message} />;
  }
  const [ctx, plan, replace] = ready;
  return (
    <CanvasEditor
      pieceId={piece.id}
      title={piece.set_title ?? titleFromSlots(piece.slots) ?? ctx.title}
      formatLabel={ctx.formatLabel}
      backHref={back}
      canReplace={replace}
      initial={{ slots: plan.slots, edits: piece.edits }}
      plan={plan}
      slotMeta={ctx.slots}
      library={ctx.library}
    />
  );
}

function CannotOpen({ back, text }: { back: string; text: string }) {
  return (
    <div data-fullbleed className="flex min-h-dvh items-center justify-center bg-[#F5F5F5] p-6 text-[13px]">
      <div className="max-w-sm space-y-3 rounded-lg bg-background p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
        <p className="text-[15px] font-medium">This piece can’t open in Canvas</p>
        <p className="text-foreground/60">{text}</p>
        <Link href={back} className="inline-flex h-8 items-center rounded-md bg-foreground/[0.05] px-3 hover:bg-foreground/[0.09]">Back to the gallery</Link>
      </div>
    </div>
  );
}
