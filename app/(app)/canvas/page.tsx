import { CanvasEditor } from '@/components/canvas/editor';
import { canvasLibrary } from '@/lib/canvas';
import { currentUser } from '@/lib/team';

export const metadata = { title: 'Canvas' };
export const dynamic = 'force-dynamic';

// Canvas without a piece: the editor itself, with the Library open to pick a template or a piece.
export default async function CanvasHome() {
  const me = (await currentUser())!;
  return <CanvasEditor library={await canvasLibrary(me)} />;
}
