import { Admin } from './admin';
import { Assets } from './assets';
import { Brands } from './brands';
import { Canvas } from './canvas';
import { ConnectClaude } from './connect-claude';
import { Explorations } from './explorations';
import { Gallery } from './gallery';
import { MakeDesigns } from './make-designs';
import { Overview } from './overview';
import { PhotosLogos } from './photos-logos';
import { Rules } from './rules';
import { Templates } from './templates';
import { WhatsNew } from './whats-new';

// Each Docs section's content, by slug (lib/docs.ts has their titles and headings).
export const SECTIONS: Record<string, () => React.ReactNode> = {
  '': Overview, 'connect-claude': ConnectClaude, 'make-designs': MakeDesigns, 'photos-logos': PhotosLogos, gallery: Gallery,
  templates: Templates, explorations: Explorations, canvas: Canvas, assets: Assets, brands: Brands, rules: Rules, admin: Admin, 'whats-new': WhatsNew,
};
