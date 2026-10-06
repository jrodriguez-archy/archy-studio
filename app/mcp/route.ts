import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { verifyMcpToken } from '@/lib/mcp-auth';
import { z } from 'zod';
import { MissingRequired, render } from '@/lib/renderer';
import { FACTS, PURPOSES, factsFromSlots, matchTemplates } from '@/lib/match';
import { createProject, findProject, listProjects } from '@/lib/projects';
import { saveRender } from '@/lib/renders';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/supabase/admin';
import { listTemplates, loadConfig, loadLibrary, loadManifest } from '@/lib/templates';

export const runtime = 'nodejs';
export const maxDuration = 60;

const INSTRUCTIONS = `Archy Studio: Archy marketing templates. Turn a brief ("we have booth #1211 at the Chicago Midwinter Meeting, Feb 18 to 20") into finished PNGs built from Archy's approved Paper templates.

Brief first, then the best template:
1. Read the whole brief and list the facts it brings (event name, city, venue, date, time, booth, photos, logos, speaker...). Use the fact names of match_templates.
2. Call match_templates with those facts (and the purpose if clear). It returns the templates that can be made with them, best first, and for the others what is missing.
3. Ask once, in one short message, for what would unlock a better template or is missing (a city photo, the partner logo, the time...). Never invent facts.
4. With the answers, call match_templates again and pick the best eligible template (offer two when they are equally good). If none is eligible, say what is missing; never force a template.
5. get_template for its slots and limits, then render. Each template has essential content (always filled) and minor optional details: an optional detail you do not have is left out with its label (no time: the date stays alone).
6. If copy does not fit, the format is refused with the exact maximum: shorten keeping the requester's wording, then render again. Never deliver a refused render.
7. Show the images, give the download links, and say in one line which template you chose and why, and what was left out.

Projects: pieces can be filed into project folders in the Studio gallery (one project per piece). When the requester names a project or campaign ("save it in Chicago Midwinter"), call list_projects and pass that project to render. If it does not exist, create it with create_project (shared with the team unless they say it is only for them). Do not ask about projects when the requester does not mention one.

Brand rules:
- All copy on the piece is in US English, even when the conversation is not.
- Photos of people are always the person's real photo, from the approved library (list_assets) or provided by the requester as an https link to a cutout PNG. Never generate a person or use someone else's photo.
- Partner and sponsor logos come as https links (PNG or SVG); they are set in the design's colour at an optically balanced size.
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
            category: c.category,
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
        const optional = new Set(c.optional ?? []);
        const derivedFrom = (k: string) => c.derive?.[k]?.from;
        const variantFor = (k: string) => Object.entries(m.variants ?? {}).find(([, v]) => v.when?.empty?.includes(k))?.[0];
        const slots = Object.fromEntries(Object.entries(m.slots).map(([k, s]) => [k, {
          type: s.type,
          example: s.type === 'text' ? s.default : undefined,
          essential: !optional.has(k),
          fact: c.facts?.[k] ?? 'copy written from the brief',
          when_missing: !optional.has(k)
            ? derivedFrom(k) ? `derived from ${derivedFrom(k)}; otherwise ask, or use another template` : 'ask for it, or use another template (match_templates)'
            : s.type === 'image' && variantFor(k) ? `the "${variantFor(k)}" version is used` : 'left out with its label, the layout closes up',
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
      'match_templates',
      {
        title: 'Match templates to a brief',
        description: 'Which templates can be made with the facts a brief brings, best first, and what each other template is missing. Call it after reading the brief, and again after asking for missing facts.',
        inputSchema: z.object({
          facts: z.array(z.enum(FACTS)).describe('Facts the brief brings. person = the name of the person featured; ground-photo = a city or venue photo for a cover background; guest-photo = people enjoying a venue.'),
          purpose: z.enum(PURPOSES).optional().describe('What the piece is for, when clear from the brief.'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ facts, purpose }) => {
        const all = await matchTemplates(facts, purpose);
        const eligible = all.filter((m) => m.eligible).slice(0, 6).map((m) => ({ template: m.template, title: m.title, purpose: m.purpose, shows: m.shows, not_shown: m.unused }));
        const almost = all.filter((m) => !m.eligible && m.missing.length <= 2).slice(0, 6).map((m) => ({ template: m.template, title: m.title, needs: m.missing }));
        return { content: [{ type: 'text', text: JSON.stringify({ eligible, would_fit_with_more_info: almost }, null, 2) }] };
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
      'list_projects',
      {
        title: 'List projects',
        description: 'Project folders in the Studio gallery that the signed-in person can file pieces into: the team ones and their own personal ones.',
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async (_args, ctx) => {
        const me = await whoIs(ctx);
        if (!me) return { isError: true, content: [{ type: 'text', text: 'Projects need a signed-in Studio account.' }] };
        const list = (await listProjects(me)).map((p) => ({ project: p.name, id: p.id, visible_to: p.shared ? 'team' : 'only the requester', pieces: p.count }));
        return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
      },
    );

    server.registerTool(
      'create_project',
      {
        title: 'Create a project',
        description: 'Create a project folder in the Studio gallery. If one with the same name already exists, that one is returned.',
        inputSchema: z.object({
          name: z.string().min(1).max(80).describe('Project name, e.g. "Chicago Midwinter 2027"'),
          shared: z.boolean().default(true).describe('true: the whole team sees it (default). false: only the requester.'),
        }),
      },
      async ({ name, shared }, ctx) => {
        const me = await whoIs(ctx);
        if (!me) return { isError: true, content: [{ type: 'text', text: 'Projects need a signed-in Studio account.' }] };
        const p = await createProject(me, name, shared);
        return { content: [{ type: 'text', text: `Project "${p.name}" ready (${p.shared ? 'team' : 'only the requester'}). Pass it to render as project.` }] };
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
          project: z.string().optional().describe('Project to file the pieces in (name or id from list_projects). Only when the requester mentions one.'),
        }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ template, formats, slots, project }, ctx) => {
        let projectId: string | null = null;
        if (project) {
          const me = await whoIs(ctx);
          const found = me ? await findProject(me, project) : null;
          if (!found) return { isError: true, content: [{ type: 'text', text: `No project "${project}" for this account. Call list_projects, or create_project first.` }] };
          projectId = found.id;
        }
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
              const have = await factsFromSlots(template, slots);
              // Same purpose first (a booth invite suggests booth invites, not reminders).
              const purpose = (await loadConfig(template)).purpose;
              const fits = async (p?: string) => (await matchTemplates(have, p)).filter((x) => x.eligible && x.template !== template).slice(0, 3).map((x) => x.template);
              const same = await fits(purpose);
              const alt = same.length ? same : await fits();
              return { isError: true, content: [{ type: 'text', text: `${template} needs ${e.slots.join(', ')} (essential content; it never goes out half empty). Ask the requester for it${alt.length ? `, or use a template that fits what you have: ${alt.join(', ')}` : ''}.` }] };
            }
            throw e;
          }
          const { png, report, variant, slots: used } = out;
          if (!report.ok) {
            refused.push(`${format}: ` + report.errors.map((e) => `${e.slot ?? e.node}: ${e.message}`).join(' | '));
            continue;
          }
          // The 2x file goes to the shared gallery (Supabase) and the link is a signed download.
          // Without Supabase configured, the link re-renders the same piece (every decision explicit).
          let download: string;
          const saved = supabaseConfigured()
            ? await render({ template, format, slots, scale: 2 }).then((hi) => saveRender({
                userId: userIdOf(ctx), template, format, slots: used, png: hi.png, width: hi.width, height: hi.height, scale: 2, projectId,
              }))
            : null;
          if (saved) download = saved.url;
          else {
            const q = new URLSearchParams({ template, format, scale: '2' });
            for (const [k, v] of Object.entries(used)) q.set(`slot.${k}`, v ?? '');
            download = `${origin}/api/render?${q.toString()}`;
          }
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
            text: `${m.formats[format].label}: ready.${notes.length ? ` ${notes.join('. ')}.` : ''} Download (2x PNG): ${download}`,
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
    serverInfo: { name: 'archy-studio', version: '0.5.0' },
    instructions: INSTRUCTIONS,
  },
);

// Signed-in user behind the MCP call (set by the auth layer once the MCP requires login).
function userIdOf(ctx: unknown): string | null {
  const auth = (ctx as { http?: { authInfo?: { extra?: { userId?: string } } } })?.http?.authInfo;
  return auth?.extra?.userId ?? null;
}

async function whoIs(ctx: unknown): Promise<{ id: string; is_admin: boolean } | null> {
  const id = userIdOf(ctx);
  if (!id || !supabaseConfigured()) return null;
  const { data } = await supabaseAdmin().from('profiles').select('id, is_admin').eq('id', id).maybeSingle();
  return (data as { id: string; is_admin: boolean } | null) ?? null;
}

function publicOrigin(ctx: unknown): string {
  const req = (ctx as { http?: { req?: Request } })?.http?.req;
  if (req) return new URL(req.url).origin;
  return process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000';
}

// Sign-in required: Claude gets a Supabase OAuth token (magic link + consent) before using the tools.
const authed = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource/mcp',
});

export { authed as GET, authed as POST, authed as DELETE };
