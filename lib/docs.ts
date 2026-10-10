import { RELEASES, releaseId } from './whats-new';

// The Docs: one page per section, in reading order. The index, search, "On this page", prev/next and
// page titles all come from here; each section's content lives in components/docs/sections.

export type DocHeading = { id: string; title: string };
export type DocSection = {
  slug: string;
  title: string;
  group: 'Start' | 'Use' | 'Reference';
  summary: string;
  headings: DocHeading[];
  /** Extra words people may search for. */
  keywords?: string;
  admin?: boolean;
};

export const DOCS: DocSection[] = [
  {
    slug: '', title: 'Overview', group: 'Start', summary: 'What Archy Studio does and where to start.',
    headings: [{ id: 'what', title: 'What Studio does' }, { id: 'ways', title: 'Three ways to work' }, { id: 'brands', title: 'Archy and DOC' }, { id: 'start', title: 'Start here' }],
    keywords: 'intro welcome getting started',
  },
  {
    slug: 'connect-claude', title: 'Connect Claude', group: 'Start', summary: 'Add Archy Studio to Claude once, then ask for designs in any conversation.',
    headings: [{ id: 'claude-app', title: 'In the Claude app' }, { id: 'terminal', title: 'Claude Code in a terminal' }, { id: 'check', title: 'Check that it works' }, { id: 'can-do', title: 'What Claude can do' }, { id: 'signed-out', title: 'If Claude is not signed in' }],
    keywords: 'install plugin marketplace mcp connector sign in authenticate cowork code',
  },
  {
    slug: 'make-designs', title: 'Make designs with Claude', group: 'Use', summary: 'Brief Claude in your own words and get finished designs in every format.',
    headings: [{ id: 'brief', title: 'Write a brief' }, { id: 'examples', title: 'Example briefs' }, { id: 'what-happens', title: 'What Claude does' }, { id: 'formats', title: 'Formats and covers' }, { id: 'options', title: 'Options, designs and themes' }, { id: 'fit', title: 'When copy does not fit' }, { id: 'left-out', title: 'Details left out' }, { id: 'sets', title: 'Sets and new versions' }, { id: 'projects', title: 'Projects' }, { id: 'from-studio', title: 'Start from Studio' }],
    keywords: 'brief prompt render ask request copy headline shorter smaller text option version set project cover',
  },
  {
    slug: 'photos-logos', title: 'Photos and logos', group: 'Use', summary: 'Real photos, placeholders, photo links and partner logos.',
    headings: [{ id: 'people', title: 'Photos of people' }, { id: 'placeholders', title: 'Placeholder photos' }, { id: 'photo-links', title: 'Send photos with a photo link' }, { id: 'from-assets', title: 'Use a photo from Assets' }, { id: 'links', title: 'Photos as links' }, { id: 'logos', title: 'Partner and sponsor logos' }],
    keywords: 'image picture headshot portrait cutout attach upload link silhouette logo partner sponsor',
  },
  {
    slug: 'gallery', title: 'Gallery, sets and projects', group: 'Use', summary: 'Find, download and organise everything Studio made.',
    headings: [{ id: 'gallery', title: 'The gallery' }, { id: 'open-set', title: 'Open a set' }, { id: 'download', title: 'Download' }, { id: 'set-menu', title: 'The set menu' }, { id: 'projects', title: 'Projects' }, { id: 'archive', title: 'Archive' }, { id: 'who', title: 'Who can change what' }],
    keywords: 'download zip png move rename archive delete restore link share folder project',
  },
  {
    slug: 'templates', title: 'Templates', group: 'Use', summary: 'The approved designs Studio builds from.',
    headings: [{ id: 'catalog', title: 'The catalog' }, { id: 'formats', title: 'Formats' }, { id: 'designs-themes', title: 'Designs and themes' }, { id: 'template-page', title: 'A template’s page' }, { id: 'use', title: 'Use a template' }],
    keywords: 'catalog layout post square stories og cover theme design slot limits room',
  },
  {
    slug: 'explorations', title: 'Explorations', group: 'Use', summary: 'New designs in the brand when no template fits.',
    headings: [{ id: 'what', title: 'What an exploration is' }, { id: 'when', title: 'When Claude explores' }, { id: 'ask', title: 'How to ask' }, { id: 'references', title: 'References and Notion briefs' }, { id: 'kinds', title: 'Two kinds of piece' }, { id: 'images', title: 'Images' }, { id: 'product', title: 'The product' }, { id: 'mascot', title: 'The mascot' }, { id: 'checks', title: 'What Studio checks' }, { id: 'change', title: 'Change it' }, { id: 'propose', title: 'Propose it as a template' }, { id: 'not-yet', title: 'Not yet' }],
    keywords: 'explore exploration new design no template banner linkedin email flyer reference notion generated ai image mascot robot agent pose product screen scrim propose',
  },
  {
    slug: 'canvas', title: 'Canvas', group: 'Use', summary: 'Fix copy, photos, colours and sizes by hand, or with Claude.',
    headings: [{ id: 'open', title: 'Open a design' }, { id: 'panels', title: 'The panels' }, { id: 'text', title: 'Edit text' }, { id: 'images', title: 'Photos and logos' }, { id: 'parts', title: 'Move, align and resize' }, { id: 'recolor', title: 'Recolor' }, { id: 'formats', title: 'Formats side by side' }, { id: 'inspector', title: 'The Inspector' }, { id: 'save', title: 'Save and download' }, { id: 'claude', title: 'Edit with Claude' }, { id: 'shortcuts', title: 'Keyboard shortcuts' }],
    keywords: 'editor edit change text photo reframe zoom color colour recolor align inspector save update download shortcuts undo',
  },
  {
    slug: 'assets', title: 'Assets', group: 'Use', summary: 'The team’s images: uploads, cutouts, effects and generated images.',
    headings: [{ id: 'upload', title: 'Upload' }, { id: 'folders', title: 'Folders' }, { id: 'find', title: 'Find images' }, { id: 'effects', title: 'Effects' }, { id: 'generate', title: 'Generate an image' }, { id: 'limits', title: 'Daily limits' }, { id: 'use', title: 'Use an image' }],
    keywords: 'images photos upload folder remove background cutout pixel generate ai edit id',
  },
  {
    slug: 'brands', title: 'Archy and DOC', group: 'Reference', summary: 'Two brands in one Studio, never mixed.',
    headings: [{ id: 'switch', title: 'Switch brand' }, { id: 'separate', title: 'What each brand keeps' }, { id: 'doc-templates', title: 'DOC templates' }, { id: 'doc-rules', title: 'DOC rules' }],
    keywords: 'dental ownership collective brand switch tracks foundations startup acquisition',
  },
  {
    slug: 'rules', title: 'Rules and FAQ', group: 'Reference', summary: 'What Studio always does, and answers to common questions.',
    headings: [{ id: 'rules', title: 'The rules' }, { id: 'faq', title: 'Questions' }, { id: 'trouble', title: 'Troubleshooting' }, { id: 'account', title: 'Your account' }],
    keywords: 'faq help problem error not working password english facts',
  },
  {
    slug: 'admin', title: 'For admins', group: 'Reference', summary: 'Who can sign in, reviewing new templates, and what the team asks for.', admin: true,
    headings: [{ id: 'team', title: 'Team' }, { id: 'review', title: 'Template review' }, { id: 'missing', title: 'Missing templates' }, { id: 'proposals', title: 'Template proposals' }],
    keywords: 'admin team add person reset password remove review approve',
  },
  {
    slug: 'whats-new', title: 'What’s new', group: 'Reference', summary: 'What changed in each version of Studio.',
    headings: RELEASES.map((r) => ({ id: releaseId(r.version), title: r.version })),
    keywords: 'version update release changelog news new',
  },
];

export const docHref = (slug: string) => (slug ? `/docs/${slug}` : '/docs');
export const docsFor = (isAdmin: boolean) => DOCS.filter((d) => !d.admin || isAdmin);
