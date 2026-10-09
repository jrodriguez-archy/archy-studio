import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { verifyMcpToken } from '@/lib/mcp-auth';
import { z } from 'zod';
import { editCanvas, getCanvas, saveCanvas } from '@/lib/canvas-claude';
import { MissingRequired, render } from '@/lib/renderer';
import { shortId } from '@/lib/asset-ids';
import { photoPlaceholder, placeholderNote, type Placeholder } from '@/lib/placeholders';
import { FACTS, PURPOSES, factsFromSlots, matchTemplates } from '@/lib/match';
import { createProject, findProject, listProjects } from '@/lib/projects';
import { resolveSet, saveRender } from '@/lib/renders';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/supabase/admin';
import { DAILY, getAsset, listAssets, listFolders, useAi } from '@/lib/assets';
import { outpaintFor, type Edits, type Framing } from '@/lib/canvas-shared';
import { directFileLink, DIRECT_DAYS } from '@/lib/file-links';
import { keepLinkedImage } from '@/lib/keep-image';
import { extendPhoto } from '@/lib/outpaint';
import { createPhotoRequest, getPhotoRequest } from '@/lib/photo-requests';
import { comboFormats, listTemplates, loadConfig, loadManifest, resolveCombo, templateBrand } from '@/lib/templates';
import { BRAND_IDS } from '@/lib/brands';

export const runtime = 'nodejs';
export const maxDuration = 300;

const INSTRUCTIONS = `Archy Studio: Archy marketing templates. Turn a brief ("we have booth #1211 at the Chicago Midwinter Meeting, Feb 18 to 20") into finished PNGs built from Archy's approved Paper templates.

Template ID given: when the requester names a template ID (e.g. "booth-icon-list", copied from the Studio app) or a /templates?t=<id> link, use that template directly: skip match_templates, call get_template, ask once only for its missing essential facts, then render. A prompt that says "Keep it in set <id>" renders with that set.

Brief first, then the best template:
1. Read the whole brief and list the facts it brings (event name, city, venue, date, time, booth, photos, logos, speaker...). Use the fact names of match_templates.
2. Call match_templates with those facts (and the purpose if clear). It returns the templates that can be made with them, best first, and for the others what is missing.
3. Ask once, in one short message, for what would unlock a better template or is missing (the partner logo, the time...). Never invent facts. Photos never hold a design back: a template that shows photos is made anyway, with placeholder photos close to the brief, and the real ones are asked for in that same message (photos_to_ask_for).
4. With the answers, call match_templates again and pick the best eligible template (offer two when they are equally good). When the requester asks for options, make each option a different template (or design or theme), not the same design with other copy; a copy-only variation only when they ask for one, and then without set, so it stands on its own in the gallery. If none is eligible, say what is missing; never force a template.
5. get_template for its slots and limits, then render. Each template has essential content (always filled) and minor optional details: an optional detail you do not have is left out with its label (no time: the date stays alone).
6. If copy does not fit, the format is not delivered and the answer brings two options: shorter copy (with the exact maximum) and, when it works, smaller text (a preview, down to 70%). Show both and let the requester choose; offer a shorter version written by you (same facts, their wording). If they choose smaller text, render again with smaller_text: true. Never deliver a render that did not fit. Short copy needs no padding: the design fills its room by itself (the headline takes the size and lines its room allows, the logo stays at the bottom), so never add words just to fill space. A headline on three or four big lines is right, not a problem.
7. Show the images, give the download links and the Edit in Canvas link (where the requester can fix copy, colours, images or sizes by hand), and say in one line which template you chose and why, what was left out, and which photos are placeholders.

Framing photos: a photo is cropped to its frame from its centre unless you say otherwise. Look at every render: when what matters in a photo (a face, a tattoo, a product) is cut off or hidden behind the design (a pixel band, the copy), render again with framing for that slot: focus_x / focus_y (0–100 %, where that subject is in the photo, across and down) keep it at the frame's centre as far as the photo allows; zoom above 1 comes closer. When the photo is too tall or too wide for the frame to show the subject whole, use zoom below 1 with fill_around: true: AI paints the rest of the scene around the photo so it fills the frame (it can invent details: look at the result and say it was extended). Framing is kept in the design, so Canvas opens it as rendered.

Images from links: an https image (a Notion, Drive or other signed link) is kept in Assets the first time it is used, so the design keeps working after the link expires. If the link no longer opens, ask for the photo with request_photos.

Downloads: each format gives "Download (2x PNG)" (the lasting link for people signed in to Studio, to share) and "File" (works without signing in for a few days): save files with the File link.

Designs and themes: some templates (list_templates shows designs and themes) come in several designs (layouts) and themes (White, Royal Blue, Navy grounds) with the same slots. Use the default unless the requester asks for one or for options; to offer options, render two or three different designs (and themes when they ask about colour) in the same set and say which is which. get_template with the design and theme gives that combination's limits, and some slots exist only in some designs (only_in_designs). Changing the design or theme of a design already made is a new render with the same facts and set, not a Canvas recolour.

Event page covers: the event templates have a cover format (1200×900, the Webflow event page thumbnail) next to Post, Square, Stories and OG. It is never part of "all formats": after making the social formats, offer the cover in one short line; never force it. If they want it, render the same template with formats: ["cover"], the same facts, design, theme and set, so it stacks with the social formats. The cover splits the headline in two and prints "Booth" with the number by itself; its own photos (a city or venue photo for its ground, on a few covers a guest photo) come as placeholders when the brief has none: ask for the real ones. Its short cover-subhead is written from the brief, never the template's sample.

Projects: designs can be filed into project folders in the Studio gallery (one project per design). When the requester names a project or campaign ("save it in Chicago Midwinter"), call list_projects and pass that project to render. If it does not exist, create it with create_project (shared with the team unless they say it is only for them). Do not ask about projects when the requester does not mention one.

Sets: every render answer ends with "Set: <id>". All designs from one brief (more formats, retries after shortening copy, other templates or options) belong together: pass that id as set to every later render of the same brief. A new brief starts without set.

Brands: Studio makes work for two brands that never mix. Archy (default) and DOC, the Dental Ownership Collective (ownership education for dentists; Archy appears on DOC only as its sponsor). When the brief is for DOC (it says DOC, Dental Ownership Collective, Foundations / Startup / Acquisition tracks), pass brand: "doc" to list_templates, match_templates, list_assets, list_projects and create_project; otherwise leave the default. Never put an Archy template, image or project on a DOC brief or the other way round. DOC templates come in five themes (Foundations, Startup, Acquisition, Dark, Light); never invent a DOC figure, price, date or quote.

Brand rules:
- All copy on the design is in US English, even when the conversation is not.
- Photos of people are always the person's real photo, from the team's images (list_assets; a cutout without background works best) or provided by the requester as an https link to a cutout PNG. When they attach a photo in the chat (Studio cannot read it) or have it on their computer, make the design with its placeholder, then give one photo link for every photo still missing (request_photos) and, when they say they are done, get_photos and render again with the same set. Never generate a person or use someone else's photo; until the person's photo comes, a neutral silhouette holds its place.
- Partner and sponsor logos come as https links (PNG or SVG); they are set in the design's colour at an optically balanced size.
- Keep the template's fixed text and design as they are; only the slots change.

Canvas (live editing with the person): when they ask to change a design they have open in Studio's Canvas ("make the headline shorter", "recolour it light", "use a ticket icon", "fix the alignment"), you are the designer: call get_canvas, then make the change yourself with edit_canvas (they watch it happen live and can undo it). Refer to components by their id from get_canvas. Each answer lists the Inspector's suggestions: fix the ones your change caused, with fix: "all" (the Inspector's own exact fixes) or your own change, and check again. Never tell the person how to do something by hand in Canvas when you can do it. When a change could go in more than one place (a photo, with a ground photo and a guest photo on the design), ask once where, naming the places in plain words, before you make it. Change only what they ask: copy on the design that does not come from the brief (a template sample, another event's details) is pointed out and a version from the brief offered, not rewritten on your own. The formats of a set follow each other in Canvas while it is open (copy, images, recolour): when they ask for a change in one format only, say the others change too unless they unsync that format (its label in Canvas), and say when formats end up different. Brand colours only; the brand logo (Archy logo, DOC lockup) can only be moved, aligned or scaled. Save with save_canvas only when they ask.`;

type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string };

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'list_templates',
      {
        title: 'List templates',
        description: 'The templates of one brand (Archy by default, or DOC), with what each is for, its formats, designs and themes (when it offers several) and editable slots.',
        inputSchema: z.object({ brand: z.enum(BRAND_IDS).default('archy').describe('archy (default) or doc: the brand the requester is working for. DOC = Dental Ownership Collective, a separate brand.'), }),
        annotations: { readOnlyHint: true },
      },
      async ({ brand }) => {
        const manifests = await listTemplates(brand);
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
            designs: m.designs && Object.fromEntries(Object.entries(m.designs).map(([k, d]) => [k, d.label])),
            themes: m.themes && Object.fromEntries(Object.entries(m.themes).map(([k, t]) => [k, t.label])),
            default: m.default,
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
        description: 'Slots of one template: type, example, which are required, what happens when one is missing, and measured length limits per format. On templates with several designs and themes, the limits are those of the design and theme asked for (default when not given).',
        inputSchema: z.object({
          template: z.string().describe('Template id from list_templates, e.g. "ae-spotlight"'),
          design: z.string().optional().describe('Design id from list_templates (templates that offer several), e.g. "the-arch"'),
          theme: z.string().optional().describe('Theme id from list_templates (templates that offer several), e.g. "navy"'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ template, design, theme }) => {
        const m = await loadManifest(template);
        const c = await loadConfig(template);
        const combo = resolveCombo(m, design, theme);
        // Limits and slot presence of this design × theme, keyed by plain format.
        const keyOf = (f: string) => (combo?.key ? `${f}--${combo.key}` : f);
        const formats = comboFormats(m, combo);
        const inCombo = (k: string) => !m.slots[k].perFormat || Object.keys(formats).some((f) => keyOf(f) in m.slots[k].perFormat!);
        const designsWith = (k: string) => m.default && Object.keys(m.designs ?? {}).filter((d) => {
          const key = d === m.default!.design ? null : Object.keys(m.combos ?? {}).find((x) => x.startsWith(`${d}--`));
          return Object.keys(m.formats).some((f) => (key ? `${f}--${key}` : f) in (m.slots[k].perFormat ?? {}));
        });
        const optional = new Set(c.optional ?? []);
        const derivedFrom = (k: string) => c.derive?.[k]?.from;
        // Slots only some formats draw (the cover's ground photo, an OG without the venue line).
        const formatsWith = (k: string) => Object.keys(formats).filter((f) => !m.slots[k].perFormat || keyOf(f) in m.slots[k].perFormat!);
        const slots = Object.fromEntries(Object.entries(m.slots).filter(([k]) => inCombo(k)).map(([k, s]) => [k, {
          type: s.type,
          only_in_designs: m.default && designsWith(k)!.length < Object.keys(m.designs ?? {}).length ? designsWith(k) : undefined,
          only_in_formats: formatsWith(k).length < Object.keys(formats).length ? formatsWith(k) : undefined,
          example: s.type === 'text' ? (Object.entries(s.perFormat ?? {}).find(([f]) => f === keyOf('post'))?.[1] as { sample?: string } | undefined)?.sample ?? s.default : undefined,
          essential: !optional.has(k),
          fact: c.facts?.[k] ?? 'copy written from the brief',
          when_missing: s.type === 'image' && !optional.has(k)
            ? derivedFrom(k) ? `derived from ${derivedFrom(k)}; otherwise a placeholder photo until the real one comes` : 'a placeholder photo until the real one comes: render anyway and ask for it'
            : !optional.has(k)
            ? derivedFrom(k) ? `derived from ${derivedFrom(k)}; otherwise ask, or use another template` : 'ask for it, or use another template (match_templates)'
            : 'left out with its label, the layout closes up',
          limits: s.limits && Object.fromEntries(Object.keys(formats).filter((f) => s.limits![keyOf(f)]).map((f) => [f, s.limits![keyOf(f)]] as const).map(([f, l]) => [f,
            k === 'headline'
              ? `about ${l.maxCharsPerLine} characters per line at full size; it takes as many lines as its room allows (the sample uses ${l.maxLines}) and stays as big as it can, shrinking to ${l.fontSize.min}px (from ${l.fontSize.max}px) only when the room runs out`
              : `${l.maxCharsPerLine} characters per line at full size, up to ${l.maxLines} line${l.maxLines > 1 ? 's' : ''}; the type can shrink to ${l.fontSize.min}px (from ${l.fontSize.max}px) to fit a bit more`])),
        }]));
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              template, title: c.title, use_when: c.useWhen, not_when: c.notWhen,
              ...(combo ? {
                design: combo.design, theme: combo.theme,
                designs: Object.fromEntries(Object.entries(m.designs ?? {}).map(([k, d]) => [k, d.label])),
                themes: Object.fromEntries(Object.entries(m.themes ?? {}).map(([k, t]) => [k, t.label])),
              } : {}),
              formats: Object.fromEntries(Object.entries(formats).map(([k, f]) => [k, `${f.width}×${f.height}`])),
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
          facts: z.array(z.enum(FACTS)).describe('Facts the brief brings. person = the name of the person featured; ground-photo = a city or venue photo for an event page cover background; guest-photo = people enjoying a venue; ad-photo = a scene photo that shows a product claim (photo-led ads); stat = a real, sourced figure (DOC); object-photo = a staged photo that is the idea of a DOC ad.'),
          purpose: z.enum(PURPOSES).optional().describe('What the design is for, when clear from the brief.'),
          brand: z.enum(BRAND_IDS).default('archy').describe('archy (default) or doc: the brand the requester is working for. DOC = Dental Ownership Collective, a separate brand.'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ facts, purpose, brand }) => {
        const all = await matchTemplates(facts, purpose, brand);
        const eligible = all.filter((m) => m.eligible).slice(0, 6).map((m) => ({ template: m.template, title: m.title, purpose: m.purpose, shows: m.shows, not_shown: m.unused, ...(m.photos.length ? { photos_to_ask_for: m.photos } : {}) }));
        const almost = all.filter((m) => !m.eligible && m.missing.length <= 2).slice(0, 6).map((m) => ({ template: m.template, title: m.title, needs: m.missing }));
        return { content: [{ type: 'text', text: JSON.stringify({ eligible, would_fit_with_more_info: almost }, null, 2) }] };
      },
    );

    server.registerTool(
      'list_assets',
      {
        title: 'List the team\'s images',
        description: 'Images the team brought to Studio (Canvas → Assets): uploaded photos and logos, cutouts without background, pixel effects and generated images, newest first. Use one in an image slot as asset:<id> (the ID people copy from Studio → Assets) or its "value" (upload:<path>). Placeholder photos are not listed. For a person\'s photo use an upload or a cutout of that person; "generated" images are scenes, places and objects, never a real person.',
        inputSchema: z.object({
          search: z.string().optional().describe('Only images whose name contains this (e.g. a person\'s name)'),
          kind: z.enum(['upload', 'cutout', 'pixel', 'generated']).optional().describe('Only this kind (cutout: a person or object without background)'),
          folder: z.string().optional().describe('Only images in the team folder with this name (e.g. "Speakers")'),
          brand: z.enum(BRAND_IDS).default('archy').describe('archy (default) or doc: the brand the requester is working for. DOC = Dental Ownership Collective, a separate brand.'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ search, kind, folder, brand }) => {
        const q = search?.trim().toLowerCase();
        const folders = await listFolders(brand);
        const folderName = new Map(folders.map((f) => [f.id, f.name]));
        const inFolder = folder ? folders.find((f) => f.name.toLowerCase() === folder.trim().toLowerCase())?.id ?? '-' : null;
        // A folder is listed whole (in the database), whatever its size.
        const assets = await listAssets(inFolder ? { folderId: inFolder, limit: 1000, brand } : { limit: 300, brand });
        const items = assets
          .filter((a) => (!q || a.name.toLowerCase().includes(q)) && (!kind || a.kind === kind) && (!inFolder || a.folderId === inFolder))
          .slice(0, 60)
          .map((a) => ({ id: shortId(a.id), value: a.value, name: a.name, kind: a.kind, folder: a.folderId ? folderName.get(a.folderId) ?? null : null, by: a.author, size: a.width && a.height ? `${a.width}×${a.height}` : null, added: a.createdAt }));
        return { content: [{ type: 'text', text: JSON.stringify(items, null, 2) }] };
      },
    );

    server.registerTool(
      'request_photos',
      {
        title: 'Ask for photos with a link',
        description: 'A link where the requester drops the photos a design needs (one drop zone per photo), when they attached them in the chat or have them on their computer: Studio cannot read chat attachments. The photos join Assets in the design\'s brand, named with each label, and are cut out when the template wants a cutout. Give the link in one short line, then call get_photos when they say they are done.',
        inputSchema: z.object({
          template: z.string().optional().describe('The template the photos are for (sets the brand and which photos are cut out).'),
          photos: z.array(z.object({
            label: z.string().min(1).max(80).describe('What the photo is, as the requester knows it: the person\'s name ("Jordan Ellis") or the scene ("Staged P&L photo").'),
            slot: z.string().optional().describe('The image slot it goes in (e.g. "image-speaker-1"), from get_template.'),
          })).min(1).max(6),
          brand: z.enum(BRAND_IDS).default('archy').describe('Only when there is no template: archy (default) or doc.'),
        }),
      },
      async ({ template, photos, brand }, ctx) => {
        const me = await whoIs(ctx);
        if (!me) return { isError: true, content: [{ type: 'text', text: 'Photo links need a signed-in Studio account.' }] };
        try {
          const req = await createPhotoRequest(me.id, { template: template ?? null, brand, photos });
          return { content: [{ type: 'text', text: `Photo link (valid 1 hour): ${publicOrigin(ctx)}/u/${req.id}\nRequest: ${req.id}\nAsks for: ${req.items.map((i) => `${i.label}${i.slot ? ` (${i.slot})` : ''}${i.cutout ? ', cut out' : ''}`).join('; ')}.` }] };
        } catch (e) {
          return { isError: true, content: [{ type: 'text', text: (e as Error).message }] };
        }
      },
    );

    server.registerTool(
      'get_photos',
      {
        title: 'Get the photos from a photo link',
        description: 'The photos dropped on a link from request_photos: for each, asset:<id> to use in its image slot (render again with the same set), or that it has not arrived yet.',
        inputSchema: z.object({ request: z.string().describe('The request id from request_photos (or the link).') }),
        annotations: { readOnlyHint: true },
      },
      async ({ request }) => {
        const id = request.match(/[0-9a-f-]{36}/i)?.[0] ?? '';
        const req = await getPhotoRequest(id);
        if (!req) return { isError: true, content: [{ type: 'text', text: 'No photo link with that id.' }] };
        const items = await Promise.all(req.items.map(async (i) => {
          const a = i.asset_id ? await getAsset(i.asset_id) : null;
          return { label: i.label, slot: i.slot, photo: a ? `asset:${shortId(a.id)}` : null, cut_out: a ? a.kind === 'cutout' : undefined, status: a ? 'arrived' : 'not yet' };
        }));
        const waiting = items.filter((i) => !i.photo).length;
        return { content: [{ type: 'text', text: JSON.stringify({ items, ...(waiting ? { note: `${waiting} not arrived yet${req.expired ? '; the link has expired, make a new one' : ''}.` } : {}) }, null, 2) }] };
      },
    );

    server.registerTool(
      'list_projects',
      {
        title: 'List projects',
        description: 'Project folders in the Studio gallery that the signed-in person can file designs into: the team ones and their own personal ones, for one brand.',
        inputSchema: z.object({ brand: z.enum(BRAND_IDS).default('archy').describe('archy (default) or doc: the brand the requester is working for. DOC = Dental Ownership Collective, a separate brand.'), }),
        annotations: { readOnlyHint: true },
      },
      async ({ brand }, ctx) => {
        const me = await whoIs(ctx);
        if (!me) return { isError: true, content: [{ type: 'text', text: 'Projects need a signed-in Studio account.' }] };
        const list = (await listProjects(me, brand)).map((p) => ({ project: p.name, id: p.id, visible_to: p.shared ? 'team' : 'only the requester', pieces: p.count }));
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
          brand: z.enum(BRAND_IDS).default('archy').describe('archy (default) or doc: the brand the requester is working for. DOC = Dental Ownership Collective, a separate brand.'),
        }),
      },
      async ({ name, shared, brand }, ctx) => {
        const me = await whoIs(ctx);
        if (!me) return { isError: true, content: [{ type: 'text', text: 'Projects need a signed-in Studio account.' }] };
        const p = await createProject(me, name, shared, brand);
        return { content: [{ type: 'text', text: `Project "${p.name}" ready (${p.shared ? 'team' : 'only the requester'}). Pass it to render as project.` }] };
      },
    );

    server.registerTool(
      'get_canvas',
      {
        title: 'See the design open in Canvas',
        description: 'The design the person has open in Archy Studio Canvas (or the canvas id given): its components by name (texts with their copy, buttons, icons, photos, logos, groups), the theme and the brand colours, plus an image of it as it is now.',
        inputSchema: z.object({ piece: z.string().optional().describe('Canvas id or link of the design. Omit for the one the person has open.') }),
        annotations: { readOnlyHint: true },
      },
      async ({ piece }, ctx) => {
        const me = await whoIs(ctx);
        if (!me) return { isError: true, content: [{ type: 'text', text: 'Canvas needs a signed-in Studio account.' }] };
        try {
          const out = await getCanvas(me, piece);
          return { content: [{ type: 'image', data: out.png.toString('base64'), mimeType: 'image/png' }, { type: 'text', text: out.text }] };
        } catch (e) {
          return { isError: true, content: [{ type: 'text', text: (e as Error).message }] };
        }
      },
    );

    server.registerTool(
      'edit_canvas',
      {
        title: 'Edit the design open in Canvas',
        description: 'Change components of the design open in Canvas, by their names from get_canvas. The person sees each change live and can undo it. Brand colours only (names from get_canvas); the Archy logo can only be moved, aligned or scaled. The answer lists the Inspector’s design suggestions (misaligned, outside the safe area, hard to read…); fix them when they come from your change.',
        inputSchema: z.object({
          piece: z.string().optional().describe('Canvas id. Omit for the one the person has open.'),
          recolor: z.enum(['dark', 'blue', 'ice', 'light']).optional().describe('Recolour the whole design on a Dark (navy), Blue (royal), Ice (pale blue) or Light (white) ground. On a template with themes (get_canvas says so), prefer rendering the theme instead.'),
          changes: z.array(z.object({
            component: z.string().describe('Component id from get_canvas (best, e.g. "G5O-1"), or its name when unique; "Date (text)" picks the text over a group named the same'),
            text: z.string().optional().describe('New copy (US English). For a button, its label.'),
            color: z.string().optional().describe('Text or icon colour: a brand colour name, e.g. "white", "royal-blue-500"'),
            fill: z.string().optional().describe('Fill of a button, tag, line or the background: a brand colour name'),
            icon: z.string().optional().describe('Hugeicons name or a word to search, e.g. "ticket"'),
            hidden: z.boolean().optional(),
            font_size: z.number().optional().describe('Text size in px'),
            move: z.object({ x: z.number().optional(), y: z.number().optional() }).optional().describe('Nudge in px from where it is'),
            align: z.enum(['left', 'center', 'right', 'top', 'middle', 'bottom']).optional().describe('Align inside its container (its padding kept)'),
            scale: z.number().optional().describe('Scale, 1 = as designed (photos, the Archy logo)'),
            image: z.string().optional().describe('For a photo or logo: asset:<id> (the ID from Studio → Assets or list_assets), its upload:<path> value, or an https URL'),
            layout: z.object({
              distribute: z.enum(['packed', 'space-between']).optional(),
              gap: z.number().optional().describe('px between items when packed'),
              position: z.enum(['start', 'center', 'end']).optional().describe('Where packed items sit along the group'),
              align: z.enum(['start', 'center', 'end']).optional().describe('How items line up across the group'),
            }).optional().describe('For a group (Header, Details, Content…): how its content is spread'),
            size: z.object({ width: z.number().optional(), height: z.number().optional() }).optional().describe('New size in px (a text keeps its height automatic; a narrower width wraps it)'),
            font_weight: z.number().optional().describe('400, 500, 600 or 700'),
            opacity: z.number().optional().describe('0 to 1'),
            reset: z.boolean().optional().describe('Put this component back as designed (drops its hand edits)'),
          })).default([]),
          fix: z.enum(['all']).optional().describe('Apply every exact fix the Inspector suggests (alignment, back inside the piece or the safe area), after your changes'),
          note: z.string().optional().describe('Optional; the person sees a note written by Studio in English'),
        }),
      },
      async ({ piece, recolor, changes, fix, note }, ctx) => {
        const me = await whoIs(ctx);
        if (!me) return { isError: true, content: [{ type: 'text', text: 'Canvas needs a signed-in Studio account.' }] };
        try {
          const out = await editCanvas(me, { piece, recolor, changes, fix, note });
          const tips = out.suggestions.length ? ` The Inspector still suggests: ${out.suggestions.join(' | ')}. Fix the ones your change caused (fix: "all", or your own change).` : ' The Inspector has nothing to flag.';
          const theirs = out.personEdited ? ` The person has also changed this design in Canvas since Claude's last change${out.recolor ? ` (recolour now: ${out.recolor})` : ''}; the image shows their changes too, so do not take them for yours (get_canvas to see them).` : '';
          const synced = out.synced.length ? ` While the set is open in Canvas, ${out.syncedSlots.join(', ')} also follow to its other formats (${out.synced.join(', ')}): say so, and check them when the change is only meant for this one.` : '';
          return { content: [{ type: 'image', data: out.png.toString('base64'), mimeType: 'image/png' }, { type: 'text', text: `Done in Canvas: ${out.note}. The person sees it live and can undo it.${theirs}${synced}${tips} Save with save_canvas only when they ask.` }] };
        } catch (e) {
          return { isError: true, content: [{ type: 'text', text: (e as Error).message }] };
        }
      },
    );

    server.registerTool(
      'save_canvas',
      {
        title: 'Save the Canvas design',
        description: 'Save the design open in Canvas to the gallery as a new version (the original is kept). Only when the person asks to save it.',
        inputSchema: z.object({ piece: z.string().optional().describe('Canvas id. Omit for the one the person has open.') }),
      },
      async ({ piece }, ctx) => {
        const me = await whoIs(ctx);
        if (!me) return { isError: true, content: [{ type: 'text', text: 'Canvas needs a signed-in Studio account.' }] };
        try {
          const saved = await saveCanvas(me, piece);
          return { content: [{ type: 'text', text: `Saved as a new version. Download (2x PNG): ${publicOrigin(ctx)}/api/file/${saved.id} · File (no sign-in, ${DIRECT_DAYS} days): ${directFileLink(publicOrigin(ctx), saved.id)} · Edit in Canvas: ${publicOrigin(ctx)}/canvas/${saved.id}` }] };
        } catch (e) {
          return { isError: true, content: [{ type: 'text', text: (e as Error).message }] };
        }
      },
    );

    server.registerTool(
      'render',
      {
        title: 'Render a design',
        description: 'Fill a template with the information available and render it as PNG at the exact format size. Missing optional copy is left out and the layout adapts. A missing photo never stops it: a placeholder photo close to the brief takes its place (a neutral silhouette for a person) and the answer lists them, to ask for the real ones. Copy that does not fit is not delivered: the answer gives two options, shorter copy (with the exact maximum) or smaller text (a preview at down to 70%), for the requester to choose.',
        inputSchema: z.object({
          template: z.string().describe('Template id, e.g. "ae-spotlight"'),
          formats: z.array(z.string()).optional().describe('Formats to render, e.g. ["post", "stories"], or ["cover"] for the event page cover. Default: all but the cover.'),
          design: z.string().optional().describe('Design id, on templates that offer several (list_templates), e.g. "the-arch". Default: the template\'s default design.'),
          theme: z.string().optional().describe('Theme id, on templates that offer several (list_templates), e.g. "navy". Default: the template\'s default theme.'),
          smaller_text: z.boolean().optional().describe('Only when the requester chose "smaller text" after a render said the copy does not fit: the copy keeps its wording and may shrink to 70% (never under 14px).'),
          slots: z.record(z.string(), z.string().nullable()).describe('Slot values you have. Text slots: the copy. Image slots: "asset:<id>" (the ID from Studio → Assets), an upload:<path> value from list_assets, or an https URL (a cutout PNG for a person). Leave out (or null) what you do not have.'),
          project: z.string().optional().describe('Project to file the designs in (name or id from list_projects). Only when the requester mentions one.'),
          set: z.string().optional().describe('Set id returned by an earlier render of the same brief. Pass it for every later render of that brief (other formats, retries, other templates or options) so the gallery stacks them together.'),
          framing: z.record(z.string(), z.object({
            focus_x: z.number().min(0).max(100).optional().describe('Where the subject is in the photo, across (0 left, 100 right). Default 50.'),
            focus_y: z.number().min(0).max(100).optional().describe('Where the subject is in the photo, down (0 top, 100 bottom). Default 50.'),
            zoom: z.number().min(0.2).max(5).optional().describe('1 = the photo covers its frame (default); above 1 closer; below 1 smaller than the frame (empty bands unless fill_around).'),
            fill_around: z.boolean().optional().describe('With zoom below 1: AI paints the rest of the scene around the photo so it fills the frame (a new image in Assets; it can invent details).'),
          })).optional().describe('Per image slot (e.g. "image-photo"): where its photo sits in its frame. Use it when a render cuts off or hides what matters in the photo.'),
        }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ template, formats, design, theme, slots, project, set, framing, smaller_text: smallerText = false }, ctx) => {
        let projectId: string | null = null;
        if (project) {
          const me = await whoIs(ctx);
          // Among the projects of the template's brand.
          const found = me ? await findProject(me, project, await templateBrand(template).catch(() => 'archy' as const)) : null;
          if (!found) return { isError: true, content: [{ type: 'text', text: `No project "${project}" for this account. Call list_projects, or create_project first.` }] };
          projectId = found.id;
        }
        const m = await loadManifest(template);
        let combo;
        try { combo = resolveCombo(m, design, theme); } catch (e) { return { isError: true, content: [{ type: 'text', text: (e as Error).message }] }; }
        const files = comboFormats(m, combo);
        // "All formats" are the social ones: the event page cover is made only when asked for.
        const wanted = formats?.length ? formats : Object.keys(files).filter((f) => f !== 'cover');
        // Photos the brief does not have yet: placeholders close to it (Unsplash, else AI, else neutral; a
        // person's photo is a neutral silhouette), for the formats asked for. The real ones replace them later.
        const config = await loadConfig(template);
        const optionalSlots = new Set(config.optional ?? []);
        // Photos and logos given as links are kept in Assets first: a signed link expires, the design stays.
        const owner = userIdOf(ctx);
        const brand = await templateBrand(template).catch(() => 'archy' as const);
        try {
          for (const [k, s] of Object.entries(m.slots)) {
            const v = slots[k];
            if ((s.type === 'image' || s.type === 'logo') && v && /^https:\/\//i.test(v)) slots = { ...slots, [k]: await keepLinkedImage(v, { ownerId: owner, brand, name: `${k.replace(/^(image|logo)-/, '').replace(/-/g, ' ')} (from a link)` }) };
          }
        } catch (e) {
          return { isError: true, content: [{ type: 'text', text: (e as Error).message }] };
        }
        const asked: Record<string, Framing> | undefined = framing && Object.keys(framing).length
          ? Object.fromEntries(Object.entries(framing).map(([k, f]) => [k, { focusX: f.focus_x, focusY: f.focus_y, zoom: f.zoom }])) : undefined;
        const keys = wanted.map((f) => (combo?.key ? `${f}--${combo.key}` : f));
        const placeholders: Placeholder[] = [];
        for (const [k, s] of Object.entries(m.slots)) {
          if (s.type !== 'image' || slots[k] || optionalSlots.has(k)) continue;
          if (s.perFormat && !keys.some((f) => f in s.perFormat!)) continue;
          // Made from another photo (the cover's ground from the city photo): that one is filled instead.
          const from = config.derive?.[k]?.from;
          if (from && (slots[from] || m.slots[from]?.type === 'image')) continue;
          placeholders.push(await photoPlaceholder({ slot: k, fact: config.facts?.[k] ?? null, slots, purpose: config.purpose, userId: userIdOf(ctx) }));
        }
        if (placeholders.length) slots = { ...slots, ...Object.fromEntries(placeholders.map((p) => [p.slot, p.value])) };
        const setId = await resolveSet({ userId: userIdOf(ctx), template, slots, requested: set });
        // New pieces of a set that is already filed in a project join that project.
        if (!projectId && supabaseConfigured()) {
          const { data } = await supabaseAdmin().from('renders').select('project_id').eq('set_id', setId).not('project_id', 'is', null).limit(1);
          projectId = (data?.[0]?.project_id as string | undefined) ?? null;
        }
        const origin = publicOrigin(ctx);
        const content: Content[] = [];
        const refused: string[] = [];
        // The cover asked for with the social formats but missing its own content (its ground photo).
        let coverNeeds: string[] | null = null;
        // Formats whose copy fits in smaller text (offered as an option).
        const smallerOption: string[] = [];
        const extendNotes: string[] = [];
        for (const format of wanted) {
          let out;
          // This format's photos and framing: framing becomes crop edits, and a photo extended with
          // fill_around is this format's own (a new asset) with the crop that keeps it where it was.
          let fslots = slots;
          let fedits: Edits = {};
          try {
            out = await render({ template, format, design, theme, slots, smallerText, framing: asked });
            fedits = out.framed;
            const extended: string[] = [];
            for (const [slot, f] of Object.entries(framing ?? {})) {
              const at = f.fill_around ? out.fits[slot] : undefined;
              const plan = at && outpaintFor(at.fit);
              if (!at || !plan || !fslots[slot]) continue;
              if (!owner || !(await useAi(owner, 'outpaint'))) { extendNotes.push(`${format}: ${slot} not extended (the daily limit of ${DAILY.outpaint} is reached)`); continue; }
              try {
                const ext = await extendPhoto({ template, image: fslots[slot]!, expand: plan.expand, ownerId: owner, brand });
                fslots = { ...fslots, [slot]: ext.value };
                fedits = { ...fedits, [at.node]: { crop: plan.cropFor(ext.width, ext.height) } };
                extended.push(slot);
              } catch (e) {
                extendNotes.push(`${format}: ${slot} not extended (${(e as Error).message})`);
              }
            }
            if (extended.length) {
              out = await render({ template, format, design, theme, slots: fslots, smallerText, edits: fedits });
              extendNotes.push(`${format}: ${extended.join(', ')} extended with AI to fill the frame (look at it: it can invent details)`);
            }
          } catch (e) {
            if (e instanceof MissingRequired) {
              // Only the cover is missing its own content (its ground photo): say so, keep the other formats.
              if (format === 'cover' && wanted.length > 1) { coverNeeds = e.slots; continue; }
              const have = await factsFromSlots(template, slots);
              // Same purpose first (a booth invite suggests booth invites, not reminders).
              const purpose = (await loadConfig(template)).purpose;
              const brand = await templateBrand(template);
              const fits = async (p?: string) => (await matchTemplates(have, p, brand)).filter((x) => x.eligible && x.template !== template).slice(0, 3).map((x) => x.template);
              const same = await fits(purpose);
              const alt = same.length ? same : await fits();
              return { isError: true, content: [{ type: 'text', text: `${template} needs ${e.slots.join(', ')} (essential content; it never goes out half empty). Ask the requester for it${alt.length ? `, or use a template that fits what you have: ${alt.join(', ')}` : ''}.` }] };
            }
            throw e;
          }
          const { png, report, variant, slots: used } = out;
          if (!report.ok) {
            refused.push(`${format}: ` + report.errors.map((e) => `${e.slot ?? e.node}: ${e.message}`).join(' | '));
            // The other option: the same copy in smaller text. A preview only (not saved): the requester
            // chooses, and "smaller text" renders again with smaller_text.
            if (!smallerText) {
              const small = await render({ template, format, design, theme, slots: fslots, edits: fedits, smallerText: true }).catch(() => null);
              if (small?.report.ok) {
                const shrunk = Object.entries(small.report.slots).filter(([, x]) => x.scale && x.scale < 1).map(([k, x]) => `${k} at ${Math.round(x.scale! * 100)}%`);
                content.push({ type: 'image', data: small.png.toString('base64'), mimeType: 'image/png' });
                content.push({ type: 'text', text: `${files[format]?.label ?? format}: the copy does not fit at the normal size. Option "smaller text" (preview above, not saved): it fits as written with ${shrunk.join(', ') || 'the type reduced'}.` });
                smallerOption.push(format);
              }
            }
            continue;
          }
          // The 2x file goes to the shared gallery (Supabase) and the link is a signed download.
          // Without Supabase configured, the link re-renders the same piece (every decision explicit).
          let download: string;
          const saved = supabaseConfigured()
            ? await render({ template, format, design, theme, slots: fslots, edits: fedits, smallerText, scale: 2 }).then((hi) => saveRender({
                userId: userIdOf(ctx), template, format, slots: used, png: hi.png, width: hi.width, height: hi.height, scale: 2, projectId, setId, variant: hi.variant,
                design: hi.design, theme: hi.theme, smallerText, ...(Object.keys(fedits).length ? { edits: fedits } : {}),
              }))
            : null;
          // A link that lasts (for people signed in to Studio) until the design is archived or deleted.
          if (saved) download = `${origin}/api/file/${saved.id}`;
          else {
            const q = new URLSearchParams({ template, format, scale: '2', ...(combo ? { design: combo.design, theme: combo.theme } : {}), ...(smallerText ? { smaller_text: '1' } : {}) });
            for (const [k, v] of Object.entries(used)) q.set(`slot.${k}`, v ?? '');
            download = `${origin}/api/render?${q.toString()}`;
          }
          const notes: string[] = [];
          if (combo) notes.push(`${m.designs![combo.design].label} design, ${m.themes![combo.theme].label} theme`);
          if (smallerText) notes.push('smaller text, as chosen');
          if (variant) notes.push(`${m.variants?.[variant]?.label ?? variant} version`);
          const derived = Object.entries(used).filter(([k, v]) => v && !fslots[k] && m.slots[k].type === 'text').map(([k, v]) => `${k} "${v}" (derived)`);
          if (derived.length) notes.push(...derived);
          const left = Object.entries(report.slots).filter(([, s]) => s.status === 'removed').map(([k]) => k);
          if (left.length) notes.push(`left out: ${left.join(', ')}`);
          const fitted = Object.entries(report.slots)
            .filter(([, s]) => s.status !== 'removed' && ((s.scale && s.scale < 1) || s.wrapped || s.groupWrapped))
            .map(([k, s]) => `${k} ${[s.scale && s.scale < 1 ? `at ${Math.round(s.scale * 100)}%` : '', s.wrapped || s.groupWrapped ? `on ${s.lines ?? 2} lines` : ''].filter(Boolean).join(', ')}`);
          if (fitted.length) notes.push(`fitted: ${fitted.join('; ')}`);
          content.push({ type: 'image', data: png.toString('base64'), mimeType: 'image/png' });
          content.push({
            type: 'text',
            text: `${files[format]?.label ?? format}: ready.${notes.length ? ` ${notes.join('. ')}.` : ''} Download (2x PNG): ${download}${saved ? ` File (no sign-in, ${DIRECT_DAYS} days; use it to save the PNG): ${directFileLink(origin, saved.id)} Edit in Canvas (change copy, colours, images or sizes by hand): ${origin}/canvas/${saved.id}` : ''}`,
          });
        }
        if (refused.length) {
          content.push({ type: 'text', text: [
            'Not rendered: the copy does not fit at the normal size. Give the requester the options and let them choose (never pick for them):',
            `- Shorter copy: rewrite it within the maximum, same facts, and render again.\n${refused.join('\n')}`,
            smallerOption.length
              ? `- Smaller text (${smallerOption.join(', ')}): keeps the copy as written; the preview is above. If they choose it, render again with smaller_text: true.`
              : '- Smaller text does not make it fit either: only shorter copy works here.',
          ].join('\n') });
        }
        if (coverNeeds) content.push({ type: 'text', text: `Cover not made: it needs ${coverNeeds.join(', ')} (the event page cover's own copy). Ask the requester for it, then render formats: ["cover"] with the same set.` });
        if (extendNotes.length) content.push({ type: 'text', text: extendNotes.join('\n') });
        if (placeholders.length && content.some((c) => c.type === 'image')) content.push({ type: 'text', text: placeholderNote(placeholders) });
        content.push({ type: 'text', text: `Set: ${setId} (pass it as set to every later render of this brief so the designs stay together in the gallery).` });
        return { isError: refused.length + (coverNeeds ? 1 : 0) === wanted.length && !smallerOption.length, content };
      },
    );
  },
  {
    serverInfo: { name: 'archy-studio', version: '0.7.0' },
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
