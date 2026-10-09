import { redirect } from 'next/navigation';
import { followBrand } from '@/lib/brand';
import { newRef } from '@/lib/canvas';
import { templateBrand } from '@/lib/templates';
import { currentUser } from '@/lib/team';
import { OpenPiece } from '../open-piece';

export const metadata = { title: 'New design' };
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// A new piece from a template, with its sample copy; Save makes it a piece in the gallery.
export default async function CanvasNew({ searchParams }: { searchParams: Promise<{ template?: string; format?: string; design?: string; theme?: string }> }) {
  const { template = '', format = '', design = '', theme = '' } = await searchParams;
  const combo = design || theme ? `&design=${design}&theme=${theme}` : '';
  const me = await currentUser();
  if (!me) redirect(`/login?next=${encodeURIComponent(`/canvas/new?template=${template}&format=${format}${combo}`)}`);
  // A template of the other brand: switch to it first, so the design lands in that brand's gallery.
  const brand = await templateBrand(template).catch(() => null);
  if (brand) await followBrand(brand, `/canvas/new?template=${template}&format=${format}${combo}`);
  return <OpenPiece pieceRef={newRef(template, format, design || null, theme || null)} me={me} />;
}
