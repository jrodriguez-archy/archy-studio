import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { render } from '@/lib/renderer';
import { listTemplates, loadConfig, loadLibrary, loadManifest } from '@/lib/templates';

export const runtime = 'nodejs';
export const maxDuration = 60;

const INSTRUCTIONS = `Archy marketing templates. Turn a request ("an Instagram ad introducing Sarah, our AE in Austin") into a finished PNG built from Archy's approved Paper templates.

Workflow:
1. list_templates, pick the template that fits (use_when / not_when). If none fits, say so; do not improvise a design.
2. get_template for its slots, limits and formats.
3. Ask once for every fact the template shows that the request does not give (name, title, city, photo). Never invent facts, names or titles.
4. render. If a slot does not fit, the render is refused with the measured limit: shorten the copy keeping the requester's wording (or ask), then render again. Never deliver a refused render.
5. Show the image and give the download link. Say what you changed from the request (shortened copy, removed blocks).

Brand rules:
- All copy on the piece is in US English, even when the conversation is not.
- Photos of people are always the person's real photo, from the approved library (list_assets) or provided by the requester as an https link to a cutout PNG. Never generate a person or use someone else's photo.
- Keep the template's fixed text and design as they are; only the slots change.`;

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'list_templates',
      {
        title: 'List templates',
        description: 'The Archy templates available, with what each is for, its formats and its editable slots.',
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
        description: 'Slots of one template: type, example, measured length limits per format, which ones can be removed, and writing guidance.',
        inputSchema: z.object({ template: z.string().describe('Template id from list_templates, e.g. "ae-spotlight"') }),
        annotations: { readOnlyHint: true },
      },
      async ({ template }) => {
        const m = await loadManifest(template);
        const c = await loadConfig(template);
        const optionalOf = (slot: string) => Object.entries(m.optionals).find(([, o]) => o.contains.includes(slot))?.[0];
        const slots = Object.fromEntries(Object.entries(m.slots).map(([k, s]) => [k, {
          type: s.type,
          example: s.type === 'text' ? s.default : undefined,
          required: s.type === 'image' ? (c.requiredImages ?? []).includes(k) : !optionalOf(k),
          removable: !!optionalOf(k),
          limits: s.limits && Object.fromEntries(Object.entries(s.limits).map(([f, l]) => [f,
            `${l.maxCharsPerLine} characters per line at full size, up to ${l.maxLines} line${l.maxLines > 1 ? 's' : ''}; the type can shrink to ${l.fontSize.min}px (from ${l.fontSize.max}px) to fit a bit more`])),
        }]));
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              template, title: c.title, use_when: c.useWhen, not_when: c.notWhen,
              formats: Object.fromEntries(Object.entries(m.formats).map(([k, f]) => [k, `${f.width}×${f.height}`])),
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
        description: 'Fill a template and render it as PNG at the exact format size. Copy that does not fit is refused with the measured maximum length so it can be shortened and rendered again.',
        inputSchema: z.object({
          template: z.string().describe('Template id, e.g. "ae-spotlight"'),
          formats: z.array(z.string()).optional().describe('Formats to render, e.g. ["post", "stories"]. Default: all.'),
          slots: z.record(z.string(), z.string().nullable()).describe('Slot values. Text slots: the copy. Image slots: "asset:<id>" or an https URL to a cutout PNG. null removes a removable slot.'),
        }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ template, formats, slots }, ctx) => {
        const m = await loadManifest(template);
        const c = await loadConfig(template);
        const missing = (c.requiredImages ?? []).filter((k) => !slots[k]);
        if (missing.length) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Missing image for ${missing.join(', ')}. Use an approved photo from list_assets, or ask the requester for an https link to a cutout PNG of the person. Never use another person's photo.` }],
          };
        }
        const wanted = formats?.length ? formats : Object.keys(m.formats);
        const origin = publicOrigin(ctx);
        const content: ({ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string })[] = [];
        const refused: string[] = [];
        for (const format of wanted) {
          const { png, report } = await render({ template, format, slots });
          if (!report.ok) {
            refused.push(`${format}: ` + report.errors.map((e) => `${e.slot ?? e.node}: ${e.message}`).join(' | '));
            continue;
          }
          const q = new URLSearchParams({ template, format, scale: '2' });
          for (const [k, v] of Object.entries(slots)) q.set(`slot.${k}`, v ?? '');
          const adjusted = Object.entries(report.slots)
            .filter(([, s]) => s.status === 'removed' || (s.scale && s.scale < 1) || s.wrapped || s.groupWrapped)
            .map(([k, s]) => `${k}: ${s.status === 'removed' ? 'removed' : [s.scale && s.scale < 1 ? `type at ${Math.round(s.scale * 100)}%` : '', s.wrapped || s.groupWrapped ? 'wrapped to two lines' : ''].filter(Boolean).join(', ')}`);
          content.push({ type: 'image', data: png.toString('base64'), mimeType: 'image/png' });
          content.push({
            type: 'text',
            text: `${m.formats[format].label}: ready.${adjusted.length ? ` Adjusted to fit: ${adjusted.join('; ')}.` : ''} Download (2x PNG): ${origin}/api/render?${q.toString()}`,
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
    serverInfo: { name: 'archy-marketing', version: '0.1.0' },
    instructions: INSTRUCTIONS,
  },
);

function publicOrigin(ctx: unknown): string {
  const req = (ctx as { http?: { req?: Request } })?.http?.req;
  if (req) return new URL(req.url).origin;
  return process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000';
}

export { handler as GET, handler as POST, handler as DELETE };
