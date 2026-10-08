import { AssetManager } from '@/components/assets/asset-manager';
import { canvasLibrary } from '@/lib/canvas';
import { currentUser } from '@/lib/team';

export const metadata = { title: 'Assets · Archy Studio' };
export const dynamic = 'force-dynamic';

// Create → Assets: the team's images, wide (the same library as Canvas → Assets).
export default async function AssetsPage() {
  const me = (await currentUser())!;
  const library = await canvasLibrary(me);
  return <AssetManager assets={library.assets} folders={library.folders} designs={{ mine: library.mine, team: library.team }} />;
}
