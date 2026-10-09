import { redirect } from 'next/navigation';
import { loadSource } from '@/lib/canvas';
import { titleFromSlots } from '@/lib/gallery-shared';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/team';
import { OpenPiece } from '../open-piece';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const piece = await loadSource((await params).id);
  return { title: `${piece ? piece.set_title ?? titleFromSlots(piece.slots) ?? 'Canvas' : 'Canvas'} · Archy Studio` };
}

export default async function CanvasPiece({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ latest?: string }> }) {
  const { id } = await params;
  const me = await currentUser();
  if (!me) redirect(`/login?next=/canvas/${id}`);
  // Saved elsewhere as a new version: open the newest version of this design.
  if ((await searchParams).latest) {
    let at = id;
    for (let i = 0; i < 5; i++) {
      const { data } = await supabaseAdmin().from('renders').select('id').eq('parent_id', at).is('archived_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!data) break;
      at = data.id;
    }
    redirect(`/canvas/${at}`);
  }
  return <OpenPiece pieceRef={id} me={me} />;
}
