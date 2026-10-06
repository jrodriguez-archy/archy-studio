import { redirect } from 'next/navigation';
import { loadSource } from '@/lib/canvas';
import { titleFromSlots } from '@/lib/gallery-shared';
import { currentUser } from '@/lib/team';
import { OpenPiece } from '../open-piece';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const piece = await loadSource((await params).id);
  return { title: `${piece ? piece.set_title ?? titleFromSlots(piece.slots) ?? 'Canvas' : 'Canvas'} · Archy Studio` };
}

export default async function CanvasPiece({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentUser();
  if (!me) redirect(`/login?next=/canvas/${id}`);
  return <OpenPiece pieceRef={id} me={me} />;
}
