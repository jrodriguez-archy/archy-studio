import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { MissingRequired, render } from '@/lib/renderer';
import { listTemplates, loadConfig, loadLibrary, loadManifest } from '@/lib/templates';

export const runtime = 'nodejs';
export const maxDuration = 60;

const INSTRUCTIONS = `Archy Studio: Archy marketing templates. Turn a request ("an Instagram ad introducing Sarah, our AE in Austin") into a finished PNG built from Archy's approved Paper templates.

The templates adapt to the information available: always deliver something good with what you have.

Workflow:
1. list_templates, pick the template that fits (use_when / not_when). If none fits, say so; do not improvise a design.
2. get_template for its slots, variants, limits and formats.
3. Be proactive, once: in one short message, ask for the facts the request does not give (photo, title, city...) and say what the piece will look like without them. If they do not have them, or say to go ahead, render without them: missing copy is left out and the layout closes up, a block with nothing left disappears, and a template with a no-photo version switches to it. Only what get_template marks as required blocks a piece; then say so and offer another template if one fits. Never invent facts, names or titles, and never fill a gap with the template's sample text.
4. render. If copy does not fit, the format is refused with the exact maximum: shorten keeping the requester's wording (or ask), then render again. Never deliver a refused render.
5. Show the image and give the download link. Say in one line what was adapted (left out, no-photo version, shortened).

Brand rules:
- All copy on the piece is in US English, even when the conversation is not.
- Photos of people are always the person's real photo, from the approved library (list_assets) or provided by the requester as an https link to a cutout PNG. Never generate a person or use someone else's photo.
- Keep the template's fixed text and design as they are; only the slots change.`;

type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string };

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'list_templates',
      {
        title: 'List templates',
        description: 'The Archy templates available, with what each is for, its formats, versions and editable slots.',
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async () => {
        const manifests = await listTemplates();
        const list = await Promise.all(manifests.map(async (m) => {
          const c = await loadConfig(m.id);
          return {
            template: m.id,
            title: c.title,
            description: c.description,
            use_when: c.useWhen,
            not_when: c.notWhen,
            formats: Object.fromEntries(Object.entries(m.formats).map(([k, f]) => [k, f.label])),
            versions: Object.fromEntries(Object.entries(m.variants ?? {}).map(([k, v]) => [k, `used automatically when ${v.when?.empty?.join(', ')} is missing`])),
            slots: Object.keys(m.slots),
          };
        }));
        return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
      },
    );

    server.registerTool(
      'get_template',
      {
        title: 'Get template',
        description: 'Slots of one template: type, example, which are required, what happens when one is missing, and measured length limits per format.',
        inputSchema: z.object({ template: z.string().describe('Template id from list_templates, e.g. "ae-spotlight"') }),
        annotations: { readOnlyHint: true },
      },
      async ({ template }) => {
        const m = await loadManifest(template);
        const c = await loadConfig(template);
        const required = new Set(c.required ?? []);
        const derivedFrom = (k: string) => c.derive?.[k]?.from;
        const variantFor = (k: string) => Object.entries(m.variants ?? {}).find(([, v]) => v.when?.empty?.includes(k))?.[0];
        const slots = Object.fromEntries(Object.entries(m.slots).map(([k, s]) => [k, {
          type: s.type,
          example: s.type === 'text' ? s.default : undefined,
          required: required.has(k),
          when_missing: required.has(k)
            ? derivedFrom(k) ? `derived from ${derivedFrom(k)}; ask if both are missing` : 'ask for it'
            : s.type === 'image'
              ? variantFor(k) ? `the "${variantFor(k)}" version is used` : 'ask for it'
              : 'left out, the layout closes up',
          limits: s.limits && Object.fromEntries(Object.entries(s.limits).map(([f, l]) => [f,
            `${l.maxCharsPerLine} characters per line at full size, up to ${l.maxLines} line${l.maxLines > 1 ? 's' : ''}; the type can shrink to ${l.fontSize.min}px (from ${l.fontSize.max}px) to fit a bit more`])),
        }]));
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              template, title: c.title, use_when: c.useWhen, not_when: c.notWhen,
              formats: Object.fromEntries(Object.entries(m.formats).map(([k, f]) => [k, `${f.width}×${f.height}`])),
              versions: Object.fromEntries(Object.entries(m.variants ?? {}).map(([k, v]) => [k, `${v.label}: used automatically when ${v.when?.empty?.join(', ')} is missing`])),
              slots, guidance: c.guidance,
              notes: 'Limits are measured guides; render is the final check and reports the exact maximum when copy does not fit.',
            }, null, 2),
          }],
        };
      },
    );

    server.registerTool(
      'list_assets',
      {
        title: 'List approved assets',
        description: 'Approved Archy images (people cutouts, photos) usable in image slots as "asset:<id>".',
        inputSchema: z.object({ template: z.string().optional().describe('Only assets that fit this template') }),
        annotations: { readOnlyHint: true },
      },
      async ({ template }) => {
        const lib = await loadLibrary();
        const items = lib
          .filter((a) => !template || !a.fits || a.fits.some((f) => f.startsWith(`${template}:`)))
          .map((a) => ({ value: `asset:${a.id}`, kind: a.kind, title: a.title, description: a.description, fits: a.fits }));
        return { content: [{ type: 'text', text: JSON.stringify(items, null, 2) }] };
      },
    );

    server.registerTool(
      'render',
      {
        title: 'Render a piece',
        description: 'Fill a template with the information available and render it as PNG at the exact format size. Missing optional copy is left out and the layout adapts; without a photo the no-photo version is used. Copy that does not fit is refused with the exact maximum so it can be shortened.',
        inputSchema: z.object({
          template: z.string().describe('Template id, e.g. "ae-spotlight"'),
          formats: z.array(z.string()).optional().describe('Formats to render, e.g. ["post", "stories"]. Default: all.'),
          slots: z.record(z.string(), z.string().nullable()).describe('Slot values you have. Text slots: the copy. Image slots: "asset:<id>" or an https URL to a cutout PNG. Leave out (or null) what you do not have.'),
        }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ template, formats, slots }, ctx) => {
        const m = await loadManifest(template);
        const wanted = formats?.length ? formats : Object.keys(m.formats);
        const origin = publicOrigin(ctx);
        const content: Content[] = [];
        const refused: string[] = [];
        for (const format of wanted) {
          let out;
          try {
            out = await render({ template, format, slots });
          } catch (e) {
            if (e instanceof MissingRequired) {
              return { isError: true, content: [{ type: 'text', text: `This template needs ${e.slots.join(', ')} and there is no version without it. Ask the requester for it, or pick another template.` }] };
            }
            throw e;
          }
          const { png, report, variant, slots: used } = out;
          if (!report.ok) {
            refused.push(`${format}: ` + report.errors.map((e) => `${e.slot ?? e.node}: ${e.message}`).join(' | '));
            continue;
          }
          // Download link carries every decision explicitly (empty = left out), so it renders the same piece.
          const q = new URLSearchParams({ template, format, scale: '2' });
          for (const [k, v] of Object.entries(used)) q.set(`slot.${k}`, v ?? '');
          const notes: string[] = [];
          if (variant) notes.push(`${m.variants?.[variant]?.label ?? variant} version`);
          const derived = Object.entries(used).filter(([k, v]) => v && !slots[k] && m.slots[k].type === 'text').map(([k, v]) => `${k} "${v}" (derived)`);
          if (derived.length) notes.push(...derived);
          const left = Object.entries(report.slots).filter(([, s]) => s.status === 'removed').map(([k]) => k);
          if (left.length) notes.push(`left out: ${left.join(', ')}`);
          const fitted = Object.entries(report.slots)
            .filter(([, s]) => s.status !== 'removed' && ((s.scale && s.scale < 1) || s.wrapped || s.groupWrapped))
            .map(([k, s]) => `${k} ${[s.scale && s.scale < 1 ? `at ${Math.round(s.scale * 100)}%` : '', s.wrapped || s.groupWrapped ? 'on two lines' : ''].filter(Boolean).join(', ')}`);
          if (fitted.length) notes.push(`fitted: ${fitted.join('; ')}`);
          content.push({ type: 'image', data: png.toString('base64'), mimeType: 'image/png' });
          content.push({
            type: 'text',
            text: `${m.formats[format].label}: ready.${notes.length ? ` ${notes.join('. ')}.` : ''} Download (2x PNG): ${origin}/api/render?${q.toString()}`,
          });
        }
        if (refused.length) {
          content.push({ type: 'text', text: `Not rendered, the copy does not fit. Shorten and render again:\n${refused.join('\n')}` });
        }
        return { isError: refused.length === wanted.length, content };
      },
    );
  },
  {
    serverInfo: { name: 'archy-studio', version: '0.2.0' },
    instructions: INSTRUCTIONS,
  },
);

function publicOrigin(ctx: unknown): string {
  const req = (ctx as { http?: { req?: Request } })?.http?.req;
  if (req) return new URL(req.url).origin;
  return process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000';
}

export { handler as GET, handler as POST, handler as DELETE };
