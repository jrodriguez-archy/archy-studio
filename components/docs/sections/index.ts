import { Admin } from './admin';
import { Assets } from './assets';
import { Brands } from './brands';
import { Canvas } from './canvas';
import { ConnectClaude } from './connect-claude';
import { Gallery } from './gallery';
import { MakeDesigns } from './make-designs';
import { Overview } from './overview';
import { PhotosLogos } from './photos-logos';
import { Rules } from './rules';
import { Templates } from './templates';

// Each Docs section's content, by slug (lib/docs.ts has their titles and headings).
export const SECTIONS: Record<string, () => React.ReactNode> = {
  '': Overview, 'connect-claude': ConnectClaude, 'make-designs': MakeDesigns, 'photos-logos': PhotosLogos, gallery: Gallery,
  templates: Templates, canvas: Canvas, assets: Assets, brands: Brands, rules: Rules, admin: Admin,
};
