// What's new: each Studio version's news in plain words, for the team (the Docs page "What's new";
// the version in the account menu links there). CHANGELOG.md keeps the details. When a version is published,
// add its entry here, newest first.

export type Release = { version: string; date: string; title: string; notes: string[] };

export const RELEASES: Release[] = [
  {
    version: '0.20.0', date: '2026-10-10', title: 'What’s new and Update',
    notes: [
      'Your Studio version is in the account menu; it opens this page.',
      'When a new version is out while Studio is open, Update appears in the sidebar: one click and you are on it.',
    ],
  },
  {
    version: '0.19.0', date: '2026-10-09', title: 'Explorations',
    notes: [
      'When no template fits, Claude designs a new piece in the brand: the real logo, fonts and colours, pixel gradients, the product and the mascot.',
      'Studio checks every exploration against the brand before saving it: logo, type, contrast, text on photos.',
      'Claude can make editorial photos for an exploration, or apply Pixel Tone to a photo.',
      'Explorations show as Exploration in the gallery, with a filter, and open in Canvas like any design.',
      'Like one? Propose it as a template from its menu.',
      'Templates: “Not in the catalog?” with a brief to copy.',
    ],
  },
  {
    version: '0.18.0', date: '2026-10-09', title: 'Framing and lasting photo links',
    notes: [
      'Claude can frame each photo as it renders: closer, centred on the subject, or with the scene painted around it.',
      'Photos given as links are kept in Assets, so designs keep working when the link expires.',
      'Download links from Claude also come as a File link Claude can save.',
    ],
  },
  {
    version: '0.17.0', date: '2026-10-09', title: 'Scale photos in their frame',
    notes: [
      'Canvas: a photo’s handles scale the photo inside its frame (hold ⌥ to resize the frame).',
      'Generate content around: AI paints the rest of the scene when a photo is smaller than its frame.',
      'Big photos from a phone or a camera upload without trouble (0.17.1).',
    ],
  },
  {
    version: '0.16.0', date: '2026-10-09', title: 'Bigger headlines, never stuck on photos',
    notes: [
      'Headlines are as big as their room allows.',
      'Missing photos never stop a design: Studio uses placeholders close to the brief and Claude asks for the real ones.',
      'Download links from Claude last as long as the design.',
      'Assets: Copy ID, to use an image with Claude.',
    ],
  },
];

export const releaseId = (version: string) => `v${version.replace(/\./g, '-')}`;
