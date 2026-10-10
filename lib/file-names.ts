import { formatLabel } from './gallery-shared';

// Names of the files people download: the project, the design's name, then for a PNG its design and
// theme (options in other looks), format and size. "test-say-ahhh-mouth-concept-square-1080x1080.png",
// "test-say-ahhh-mouth-concept.zip".

export const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60).replace(/-$/, '');

type Base = { project?: string | null; title: string };
type Piece = { design?: string | null; theme?: string | null; format: string; width: number; height: number };

const base = ({ project, title }: Base) => [project, title].filter(Boolean).map((s) => slug(s!)).filter(Boolean).join('-') || 'archy';

export const zipName = (b: Base) => `${base(b)}.zip`;

export function pngName(b: Base, p: Piece) {
  const combo = slug([p.design, p.theme].filter(Boolean).join('-'));
  return [base(b), combo, slug(formatLabel(p.format)), `${p.width}x${p.height}`].filter(Boolean).join('-') + '.png';
}
