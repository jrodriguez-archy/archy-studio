import { redirect } from 'next/navigation';
import { newRef } from '@/lib/canvas';
import { currentUser } from '@/lib/team';
import { OpenPiece } from '../open-piece';

export const metadata = { title: 'New piece · Archy Studio' };
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// A new piece from a template, with its sample copy; Save makes it a piece in the gallery.
export default async function CanvasNew({ searchParams }: { searchParams: Promise<{ template?: string; format?: string }> }) {
  const { template = '', format = '' } = await searchParams;
  const me = await currentUser();
  if (!me) redirect(`/login?next=${encodeURIComponent(`/canvas/new?template=${template}&format=${format}`)}`);
  return <OpenPiece pieceRef={newRef(template, format)} me={me} />;
}
