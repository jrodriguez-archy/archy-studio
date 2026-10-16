import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { verifyMcpToken } from '@/lib/mcp-auth';
import { z } from 'zod';
import { editCanvas, getCanvas, saveCanvas } from '@/lib/canvas-claude';
import { MissingRequired, prepareFill, render, renderComposition } from '@/lib/renderer';
import { EXPLORATION, EXPLORATION_BRANDS, MAX_HTML, SIZE, brandKit, checksFor, compose, withStableIds } from '@/lib/compose';
import { randomUUID } from 'node:crypto';
import { findAsset, shortId } from '@/lib/asset-ids';
import { photoPlaceholder, placeholderNote, type Placeholder } from '@/lib/placeholders';
import { FACTS, PURPOSES, factsFromSlots, matchTemplates } from '@/lib/match';
import { createProject, findProject, listProjects } from '@/lib/projects';
import { keepSet, resolveSet, saveRender } from '@/lib/renders';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/supabase/admin';
import { DAILY, createAsset, getAsset, listAssets, listFolders, readAsset, useAi } from '@/lib/assets';
import { generateForFrame, pixelTone } from '@/lib/generate';
import { outpaintFor, type Edits, type Framing } from '@/lib/canvas-shared';
import { directFileLink, DIRECT_DAYS } from '@/lib/file-links';
import { keepLinkedImage } from '@/lib/keep-image';
import { extendPhoto } from '@/lib/outpaint';
import { createPhotoRequest, getPhotoRequest } from '@/lib/photo-requests';
import { reportMissing } from '@/lib/missing-templates';
import { comboFormats, listTemplates, loadConfig, loadManifest, resolveCombo, templateBrand } from '@/lib/templates';
import { BRAND_IDS } from '@/lib/brands';
import plugin from '@/plugins/archy-studio/.claude-plugin/plugin.json';

export const runtime = 'nodejs';
export const maxDuration = 300;

const INSTRUCTIONS = `Archy Studio turns a marketing brief ("booth #1211 at the Chicago Midwinter Meeting, Feb 18 to 20") into finished PNGs from Archy's approved Paper templates. With the archy-studio plugin, its studio skill holds this whole guide: load it.

Core steps:
1. A template ID ("booth-icon-list", copied from the Studio app) or a /templates?t=<id> link: use that template (no match_templates), get_template, ask once only for its missing essential facts, render. "Keep it in set <id>" renders in that set.
2. Otherwise read the whole brief, list the facts it brings (event name, city, venue, date, time, booth, photos, logos, speaker...; match_templates' fact names) and call match_templates (with the purpose when clear).
3. Ask once, in one short message, for what is missing or would unlock a better template (the partner logo, the time). Never invent facts. Photos never hold a design back: templates with photos are made with placeholders close to the brief, and the real photos are asked for in that same message (photos_to_ask_for).
4. With the answers, match_templates again and pick the best eligible template (offer two when equally good). Options are different templates, designs or themes, never the same design with other copy. None eligible: say what is missing; never force one.
5. get_template for slots and limits, then render. Essential content is always filled; an optional detail you lack is left out.
6. Copy that does not fit is not delivered: show both options (shorter copy within the maximum, or smaller text, then render with smaller_text: true) and let them choose.
7. Deliver: the images, the links, which template and why in one line, what was left out, which photos are placeholders. Pass "Set: <id>" as set to every later render of the same brief.
All copy on designs in US English. "Explore", or no template fits: an exploration (get_brand_kit, then compose).

Templates:
- No template for the kind of piece or size (a LinkedIn banner, a flyer, an email header), even when templates are eligible by their facts, or match_templates has nothing: offer the closest template adapted, in one line (closest_made_for_another_purpose, or a format they can use instead), and make it if they take it. If nothing is close or they decline, call report_missing_template once (Marketing & Design see what is asked for) and offer an exploration in the same message; never promise a date for a template. When they asked to explore, skip this.
- A copy-only variation only when they ask for one, rendered without set so it stands on its own in the gallery.
- An optional detail you lack is left out with its label (no time: the date stays alone).
- Copy that does not fit: also offer a shorter version you write (same facts, their wording). Never deliver a render that did not fit. Short copy needs no padding: the design fills its room by itself (the headline takes the size and lines its room allows, the logo stays at the bottom); never add words to fill space. A headline on three or four big lines is right.
- Designs and themes: some templates (list_templates shows them) come in several designs (layouts) and themes (White, Royal Blue, Navy) with the same slots. Use the default unless asked; for options render two or three designs (and themes when they ask about colour) in the same set and say which is which. get_template with the design and theme gives that combination's limits; some slots exist only in some designs (only_in_designs). Another design or theme of a design already made is a new render with the same facts and set, not a Canvas recolour.
- Event page cover (1200×900, the Webflow event page thumbnail), a format of the event templates: never part of "all formats". After the social formats, offer it in one short line; if they want it, render formats: ["cover"] with the same facts, design, theme and set. It splits the headline in two and prints "Booth" with the number by itself; its own photos (a city or venue ground, on a few covers a guest photo) come as placeholders when the brief has none (ask for the real ones); its short cover-subhead is written from the brief, never the template's sample.
- Projects (gallery folders, one per design): only when the requester names one ("save it in Chicago Midwinter"): list_projects and pass it to render; if it does not exist, create_project (shared with the team unless only for them). Never ask about projects otherwise.
- Sets: all designs from one brief (more formats, retries after shortening copy, other templates or options) pass the same set. A new brief starts without set.
- Keep the template's fixed text and design; only the slots change.

Photos and logos:
- People are always the person's real photo: from the team's images (list_assets; a cutout without background works best) or an https link to a cutout PNG. Never generate a person or use someone else's photo; a neutral silhouette holds the place until it comes. A photo attached in the chat (Studio cannot read it) or on their computer: make the design with its placeholder, give one link for every photo still missing (request_photos), and when they say they are done, get_photos and render again with the same set.
- An https image (Notion, Drive or another signed link) is kept in Assets on first use, so the design outlives the link; if the link no longer opens, request_photos.
- Partner and sponsor logos come as https links (PNG or SVG), set in the design's colour at an optically balanced size.
- Framing: a photo is cropped to its frame from its centre. Look at every render: when what matters (a face, a tattoo, a product) is cut off or hidden behind the design (a pixel band, the copy), render again with framing for that slot: focus_x / focus_y (0–100 %, where the subject is, across and down) keep it at the frame's centre as far as the photo allows; zoom above 1 comes closer. When the photo is too tall or too wide to show the subject whole, zoom below 1 with fill_around: true: AI paints the rest of the scene around it (it can invent details: look, and say it was extended). Canvas opens the framing as rendered.

Links: each format gives "Download (2x PNG)" (lasting, for people signed in to Studio: the one to share), "File" (no sign-in, a few days: save files with it) and "Edit in Canvas" (where the requester fixes copy, colours, images or sizes by hand).

Brands: Studio makes work for two brands that never mix. Archy (default) and DOC, the Dental Ownership Collective (ownership education for dentists; Archy appears on DOC only as its sponsor). When the brief is for DOC (it says DOC, Dental Ownership Collective, Foundations / Startup / Acquisition tracks), pass brand: "doc" to list_templates, match_templates, list_assets, list_projects and create_project. Never put an Archy template, image or project on a DOC brief or the other way round. DOC templates come in five themes (Foundations, Startup, Acquisition, Dark, Light); never invent a DOC figure, price, date or quote.

Explorations (Archy only): a new design outside the templates. When the requester asks to explore, for something new or without a template ("explore", "something different", "not a template"), go straight to it, without match_templates; otherwise it comes after the closest template. Call get_brand_kit once (its rules, guides and pieces are how an exploration is built: follow them), then compose each format as HTML in the kit. Start with the format they need; more only when asked. Everything the brief asks for (a feature strip, a tagline, a CTA, a URL) goes in every format: rebalance to make room; when changing or leaving out an element would read better, deliver the full version and propose the change next to it, never drop one silently. Look at every image as a designer would and fix what a designer would, and every hard problem the check reports, then compose again with the same set. Options are different compositions (image-led or typographic, ground, where the copy sits). Say which images are AI-generated, and plainly that it is an exploration Design will review, not an approved template. Explorations open in Canvas like any design; a new layout, ground or format is a new compose with the same set.

Canvas (live editing with the person): when they ask to change a design they have open in Studio's Canvas ("make the headline shorter", "recolour it light", "use a ticket icon", "fix the alignment"), you are the designer: get_canvas, then make the change yourself with edit_canvas (they watch it live and can undo it), referring to components by their id. Each answer lists the Inspector's suggestions: fix the ones your change caused, with fix: "all" (its exact fixes) or your own change, and check again. Never tell the person how to do something by hand when you can do it. When a change could go in more than one place (a photo, with a ground photo and a guest photo on the design), ask once where, in plain words. Change only what they ask: copy that does not come from the brief (a template sample, another event's details) is pointed out and a version from the brief offered, not rewritten on your own. The formats of a set follow each other while Canvas is open (copy, images, recolour): when they ask for a change in one format only, say the others change too unless they unsync that format (its label in Canvas), and say when formats end up different. Brand colours only; the brand logo (Archy logo, DOC lockup) can only be moved, aligned or scaled. save_canvas only when they ask.`;

type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string };

// A saved design's links: each format lists the addresses, and the answer explains them once.
const linksOf = (origin: string, id: string) => `Download (2x PNG): ${origin}/api/file/${id} · File: ${directFileLink(origin, id)} · Edit in Canvas: ${origin}/canvas/${id}`;
const LINKS_NOTE = `Links: "Download (2x PNG)" lasts (for people signed in to Studio): the one to share. "File" works without signing in for ${DIRECT_DAYS} days: use it to save the PNG. "Edit in Canvas" is where the requester changes copy, colours, images or sizes by hand.`;

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
        return { content: [{ type: 'text', text: JSON.stringify(list) }] };
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
        const m = await loadManifest(template).catch(() => null);
        if (!m) return { isError: true, content: [{ type: 'text', text: `No template "${template}". Templates: ${(await listTemplates()).map((t) => t.id).join(', ')}.` }] };
        const c = await loadConfig(template);
        let combo;
        try { combo = resolveCombo(m, design, theme); } catch (e) { return { isError: true, content: [{ type: 'text', text: (e as Error).message }] }; }
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
            }),
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
          formats: z.array(z.string()).optional().describe('Formats that will be rendered, as in render (e.g. ["post", "cover"]); photos_to_ask_for lists the photos they draw. Default: as render (all but the cover; the cover alone for event-cover).'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ facts, purpose, brand, formats }) => {
        const all = await matchTemplates(facts, purpose, brand, formats);
        const eligible = all.filter((m) => m.eligible).slice(0, 6).map((m) => ({ template: m.template, title: m.title, purpose: m.purpose, shows: m.shows, not_shown: m.unused, ...(m.photos.length ? { photos_to_ask_for: m.photos } : {}) }));
        const almost = all.filter((m) => !m.eligible && m.missing.length <= 2).slice(0, 6).map((m) => ({ template: m.template, title: m.title, needs: m.missing }));
        // No template for this purpose: the closest ones made for something else, to offer adapted.
        const closest = purpose && !eligible.length && !almost.length
          ? (await matchTemplates(facts, undefined, brand)).filter((m) => m.eligible).slice(0, 3).map((m) => ({ template: m.template, title: m.title, purpose: m.purpose, shows: m.shows }))
          : [];
        const note = !eligible.length && !almost.length ? 'No template fits this brief. Offer the closest one adapted when it works; if not, or when the requester declines it, call report_missing_template.' : undefined;
        return { content: [{ type: 'text', text: JSON.stringify({ eligible, would_fit_with_more_info: almost, ...(closest.length ? { closest_made_for_another_purpose: closest } : {}), ...(note ? { note } : {}) }) }] };
      },
    );

    server.registerTool(
      'get_brand_kit',
      {
        title: 'Get the brand kit for an exploration',
        description: 'The brand kit for explorations (designs for a brief no template covers): the formats and safe areas, the tokens, the grounds and pixel textures, type scale and spacing, and the pieces to copy (logo, button, pill, label and value, rulers, photo, shade). Read it before the first compose of a conversation.',
        inputSchema: z.object({ brand: z.enum(BRAND_IDS).default('archy') }),
        annotations: { readOnlyHint: true },
      },
      async ({ brand }) => {
        try {
          return { content: [{ type: 'text', text: await brandKit(brand) }] };
        } catch (e) {
          return { isError: true, content: [{ type: 'text', text: (e as Error).message }] };
        }
      },
    );

    server.registerTool(
      'generate_image',
      {
        title: 'Generate an image for an exploration',
        description: `An AI image (Nano Banana) for one frame of an exploration, at that frame's exact shape: editorial, magazine-quality, realistic photography with a subject large and close and something happening (a hygienist showing a patient their plan on a tablet, hands checking in at a front desk), never an empty room. When the object is the idea (a giant prop, a product), a studio still life on a seamless colour backdrop: say so ("studio still life, no people") and it stays as described. Write the prompt as an art director (subject, action, moment, framing, light); a weak prompt is pushed that way too. Generic people are welcome. Never a specific real person (an AE or a speaker is always their real photo), a specific real venue presented as itself, or a logo. Text in the scene is fine as long as it stays out of where the copy goes (copy_space keeps that part calm). In a piece with an image, the image is the subject: make it for the whole artboard. It joins Assets as a generated image; use it in compose as data-image="asset:<id>". Each person makes ${DAILY.explore} images a day: make one, look at it, and only then another. Tell the requester which images are AI-generated.`,
        inputSchema: z.object({
          prompt: z.string().min(10).max(800).describe('What the image shows, concretely ("a bright, modern dental front desk with a tablet on the counter, morning light, shallow depth of field"). In English.'),
          width: z.number().int().min(SIZE.min).max(SIZE.max).describe('Width of the frame the image fills, in px.'),
          height: z.number().int().min(SIZE.min).max(SIZE.max).describe('Height of the frame the image fills, in px.'),
          copy_space: z.enum(['top', 'bottom', 'left', 'right', 'none']).default('none').describe('Where copy will sit over the image: that part is kept calm.'),
          pixel_tone: z.enum(['royal', 'navy', 'ice']).optional().describe('Also make a Pixel Tone version (Archy\'s dithered grain in two brand tones): only for a place used as a quiet texture behind a typographic piece, never when the image is the subject, never with people in it.'),
          brand: z.enum(BRAND_IDS).default('archy'),
        }),
      },
      async ({ prompt, width, height, copy_space: copySpace, pixel_tone: tone, brand }, ctx) => {
        if (!EXPLORATION_BRANDS.includes(brand)) return { isError: true, content: [{ type: 'text', text: 'Images for explorations are for Archy only for now.' }] };
        const owner = userIdOf(ctx);
        if (!owner || !supabaseConfigured()) return { isError: true, content: [{ type: 'text', text: 'Generating images needs a signed-in Studio account.' }] };
        if (!(await useAi(owner, 'explore'))) return { isError: true, content: [{ type: 'text', text: `The daily limit of ${DAILY.explore} generated images is reached for this account. Use a team photo (list_assets) or a placeholder, and say so.` }] };
        try {
          const png = await generateForFrame({ prompt, width, height, copySpace, brand });
          const name = prompt.length > 48 ? `${prompt.slice(0, 47)}…` : prompt;
          const asset = await createAsset({ ownerId: owner, body: png, type: 'image/png', name, kind: 'generated', prompt, brand });
          const content: Content[] = [{ type: 'image', data: (await previewOf(png)).toString('base64'), mimeType: 'image/jpeg' }];
          let text = `Generated (AI): asset:${shortId(asset.id)} for a ${width}×${height} frame. Use data-image="asset:${shortId(asset.id)}" with background-size: cover. Look at it before using it.`;
          if (tone) {
            const toned = await pixelTone(png, { width, height }, tone);
            const t = await createAsset({ ownerId: owner, body: toned, type: 'image/png', name: `${name} · Pixel Tone ${tone}`, kind: 'pixel', parentId: asset.id, brand });
            content.push({ type: 'image', data: (await previewOf(toned)).toString('base64'), mimeType: 'image/jpeg' });
            text += `\nPixel Tone (${tone}): asset:${shortId(t.id)}, sized for this frame (background-size: cover).`;
          }
          content.push({ type: 'text', text });
          return { content };
        } catch (e) {
          const msg = (e as Error).message;
          return { isError: true, content: [{ type: 'text', text: /auth|oidc|api key|unauthorized|403|401/i.test(msg) ? 'Image generation is not set up yet (AI Gateway).' : msg }] };
        }
      },
    );

    server.registerTool(
      'pixel_tone',
      {
        title: 'Pixel Tone a photo',
        description: 'Archy\'s Pixel Tone on a photo for one frame of an exploration: the photo redrawn as a dithered grain in two brand tones (royal on blue grounds, navy on dark, ice on light), the way the event covers treat a venue. For a city, an office or a practice used as a quiet texture behind a typographic piece (the whole artboard, or the ground of a block). Never on people, never when the photo is the subject (the subject gets lost in the grain). Free (no AI). The result joins Assets; use it as data-image="asset:<id>".',
        inputSchema: z.object({
          image: z.string().describe('The photo: asset:<id>, an upload: value from list_assets, or an https link.'),
          width: z.number().int().min(SIZE.min).max(SIZE.max).describe('Width of the frame it fills, in px.'),
          height: z.number().int().min(SIZE.min).max(SIZE.max).describe('Height of the frame it fills, in px.'),
          tone: z.enum(['royal', 'navy', 'ice']),
          brand: z.enum(BRAND_IDS).default('archy'),
        }),
      },
      async ({ image, width, height, tone, brand }, ctx) => {
        const owner = userIdOf(ctx);
        if (!owner || !supabaseConfigured()) return { isError: true, content: [{ type: 'text', text: 'Pixel Tone needs a signed-in Studio account.' }] };
        try {
          let v = /^https:\/\//i.test(image) ? await keepLinkedImage(image, { ownerId: owner, brand, name: 'Photo (from a link)' }) : image.trim();
          let parent: string | null = null;
          if (v.startsWith('asset:')) {
            const a = await findAsset(v.slice(6));
            if (!a) return { isError: true, content: [{ type: 'text', text: `Unknown asset: ${v.slice(6)}. Use an ID from list_assets.` }] };
            parent = a.id;
            v = `upload:${a.path}`;
          }
          if (!v.startsWith('upload:')) return { isError: true, content: [{ type: 'text', text: 'Give the photo as asset:<id>, an upload: value or an https link.' }] };
          const { body } = await readAsset(v.slice(7));
          const toned = await pixelTone(body, { width, height }, tone);
          const t = await createAsset({ ownerId: owner, body: toned, type: 'image/png', name: `Pixel Tone ${tone} ${width}×${height}`, kind: 'pixel', parentId: parent, brand });
          return { content: [
            { type: 'image', data: (await previewOf(toned)).toString('base64'), mimeType: 'image/jpeg' },
            { type: 'text', text: `Pixel Tone (${tone}): asset:${shortId(t.id)}, sized for a ${width}×${height} frame (background-size: cover).` },
          ] };
        } catch (e) {
          return { isError: true, content: [{ type: 'text', text: (e as Error).message }] };
        }
      },
    );

    server.registerTool(
      'compose',
      {
        title: 'Compose an exploration',
        description: 'Draw a new design in the brand kit for a brief no template covers (an exploration, not an approved template): you write each format as HTML (read get_brand_kit first), Studio puts in the real logo, icons, textures and images, renders it and checks it against the brand. A format that breaks a hard rule (the logo missing, too small or without its air, fonts, a small headline, text cut off or overlapping, text on a photo without a scrim, a generated image that does not fill the artboard, a photo cutting across the piece, a floating person, a hole in a typographic piece, Sky as a ground, contrast, tiny text) is shown with the problems and not saved: fix them and compose again. A format that passes goes to the gallery labelled Exploration, with its download links. Look at every image before showing it.',
        inputSchema: z.object({
          title: z.string().min(3).max(80).describe('The design\'s name in the gallery, in English ("Spring webinar · LinkedIn banner").'),
          formats: z.array(z.object({
            name: z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/).describe('Plain format name: post, square, stories, og, linkedin-banner, email-header…'),
            width: z.number().int().min(SIZE.min).max(SIZE.max),
            height: z.number().int().min(SIZE.min).max(SIZE.max),
            html: z.string().min(20).max(MAX_HTML).describe('The artboard\'s content: HTML with inline styles in the brand kit (tokens, data-piece="logo", data-icon, data-texture, data-image).'),
          })).min(1).max(4),
          brand: z.enum(BRAND_IDS).default('archy'),
          project: z.string().optional().describe('Project to file it in (name or id from list_projects). Only when the requester mentions one.'),
          set: z.string().optional().describe('Set id from an earlier compose of the same brief (more formats, a fixed version, another option), so the gallery stacks them.'),
        }),
        annotations: { openWorldHint: false },
      },
      async ({ title, formats, brand, project, set }, ctx) => {
        if (!EXPLORATION_BRANDS.includes(brand)) return { isError: true, content: [{ type: 'text', text: `Explorations are for Archy only for now. For ${brand.toUpperCase()}, call report_missing_template.` }] };
        const owner = userIdOf(ctx);
        let projectId: string | null = null;
        if (project) {
          const me = await whoIs(ctx);
          const found = me ? await findProject(me, project, brand) : null;
          if (!found) return { isError: true, content: [{ type: 'text', text: `No project "${project}" for this account. Call list_projects, or create_project first.` }] };
          projectId = found.id;
        }
        // The same brief keeps its set (this person's, or one whose formats were all refused); otherwise a new one.
        const setId = (await keepSet(set, owner)) ?? randomUUID();
        if (!projectId && setId === set) {
          const { data } = await supabaseAdmin().from('renders').select('project_id').eq('set_id', setId).not('project_id', 'is', null).limit(1);
          projectId = (data?.[0]?.project_id as string | undefined) ?? null;
        }
        const origin = publicOrigin(ctx);
        const content: Content[] = [];
        let saved = 0;
        // Each format drawn once (at 2x when it is kept; Claude sees it at 1x), all formats side by side.
        const hiRes = supabaseConfigured();
        const made = await Promise.all(formats.map(async (f): Promise<Content[]> => {
          const out: Content[] = [];
          const label = `${f.name} (${f.width}×${f.height})`;
          let html = f.html;
          try {
            // Images given as links are kept in Assets first, so the design keeps drawing once they expire.
            for (const [, link] of [...html.matchAll(/\b(?:data-image|src)="(https:\/\/[^"]+)"/g)]) {
              const kept = await keepLinkedImage(link.replace(/&amp;/g, '&'), { ownerId: owner, brand, name: `${title} (from a link)` });
              if (kept !== link) html = html.split(`"${link}"`).join(`"${kept}"`);
            }
            const checks = await checksFor(f.width, f.height, brand);
            const comp = await compose({ html: withStableIds(html), width: f.width, height: f.height, brand, title });
            const drawn = await renderComposition({ page: comp.page, images: comp.images, width: f.width, height: f.height, checks, scale: hiRes ? 2 : 1 });
            const errors = [...comp.problems, ...drawn.report.errors.map((e) => e.message)];
            const warnings = drawn.report.warnings.map((w) => w.message);
            const preview = await previewOf(drawn.png, DESIGN);
            out.push({ type: 'image', data: preview.toString('base64'), mimeType: 'image/jpeg' });
            if (errors.length) {
              out.push({ type: 'text', text: `${label}: not saved. Fix these and compose again:\n- ${errors.join('\n- ')}${warnings.length ? `\nAlso worth fixing:\n- ${warnings.join('\n- ')}` : ''}` });
              return out;
            }
            let links = '';
            if (hiRes) {
              const rec = await saveRender({ userId: owner, template: EXPLORATION, format: f.name, slots: {}, png: drawn.png, width: f.width, height: f.height, scale: 2, projectId, setId, setTitle: title, brand, html: withStableIds(html) });
              if (rec) { saved++; links = ` ${linksOf(origin, rec.id)}`; }
            }
            out.push({ type: 'text', text: `${label}: ready, saved in the gallery as an Exploration.${links}${warnings.length ? `\nWorth fixing (guides, not refusals):\n- ${warnings.join('\n- ')}` : ''}` });
          } catch (e) {
            out.push({ type: 'text', text: `${label}: ${(e as Error).message}` });
          }
          return out;
        }));
        content.push(...made.flat());
        if (saved) content.push({ type: 'text', text: LINKS_NOTE });
        content.push({ type: 'text', text: `Set: ${setId} (pass it as set to every later compose of this brief).${saved ? ' Tell the requester it is an exploration that Design reviews, not an approved template. Small changes (copy, a colour, moving or scaling something) are made in Canvas (get_canvas / edit_canvas when they have it open); a new layout, ground or format is a new compose with the same set.' : ''}` });
        return { isError: saved === 0 && !content.some((c) => c.type === 'image'), content };
      },
    );

    server.registerTool(
      'report_missing_template',
      {
        title: 'Tell Design a template is missing',
        description: 'When no template fits the brief: a kind of piece or a size the catalog does not have (a LinkedIn banner, a flyer, an email header), or the closest template was offered and the requester declined it. Marketing & Design see what is asked for most and make those templates next. Call it once per brief, then tell the requester in one line that Design has it.',
        inputSchema: z.object({
          piece: z.string().min(3).max(200).describe('What they asked for, in a few plain words, in English ("LinkedIn banner for a webinar", "printed flyer for a study club"). Same words for the same kind of piece.'),
          format: z.string().max(80).optional().describe('The size or channel when they said it ("1584×396", "Letter, print", "email header").'),
          facts: z.array(z.enum(FACTS)).default([]).describe('The facts the brief brings, as for match_templates.'),
          purpose: z.enum(PURPOSES).optional(),
          offered: z.array(z.string()).max(6).default([]).describe('The templates offered instead, if any.'),
          reason: z.string().max(300).optional().describe('Why they did not do, in one line ("needs a horizontal banner", "they want a printed piece").'),
          brand: z.enum(BRAND_IDS).default('archy'),
        }),
      },
      async ({ piece, format, facts, purpose, offered, reason, brand }, ctx) => {
        if (!supabaseConfigured()) return { isError: true, content: [{ type: 'text', text: 'Studio is not set up to keep this (Supabase).' }] };
        try {
          await reportMissing(userIdOf(ctx), { brand, piece, format, facts, purpose, offered, reason });
          return { content: [{ type: 'text', text: 'Kept for Marketing & Design (Studio → Missing templates). Tell the requester in one line that Design has the request; do not promise a date.' }] };
        } catch (e) {
          return { isError: true, content: [{ type: 'text', text: (e as Error).message }] };
        }
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
        const folders = await listFolders(brand);
        const folderName = new Map(folders.map((f) => [f.id, f.name]));
        const inFolder = folder ? folders.find((f) => f.name.toLowerCase() === folder.trim().toLowerCase())?.id : null;
        if (folder && !inFolder) return { content: [{ type: 'text', text: `No folder "${folder}". Folders: ${folders.map((f) => f.name).join(', ') || 'none yet'}.` }] };
        // Searched in the database (the whole library, not only the newest images).
        const MAX = 60;
        const assets = await listAssets({ ...(inFolder ? { folderId: inFolder } : {}), search, kind, limit: MAX + 1, brand });
        const items = assets.slice(0, MAX)
          .map((a) => ({ id: shortId(a.id), value: a.value, name: a.name, kind: a.kind, folder: a.folderId ? folderName.get(a.folderId) ?? null : null, by: a.author, size: a.width && a.height ? `${a.width}×${a.height}` : null, added: a.createdAt }));
        const more = assets.length > MAX ? `\nThe ${MAX} newest are listed; there are more: narrow with search, kind or folder.` : '';
        return { content: [{ type: 'text', text: JSON.stringify(items) + more }] };
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
        return { content: [{ type: 'text', text: JSON.stringify({ items, ...(waiting ? { note: `${waiting} not arrived yet${req.expired ? '; the link has expired, make a new one' : ''}.` } : {}) }) }] };
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
        return { content: [{ type: 'text', text: JSON.stringify(list) }] };
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
          return { content: [{ type: 'image', data: (await previewOf(out.png, DESIGN)).toString('base64'), mimeType: 'image/jpeg' }, { type: 'text', text: out.text }] };
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
          return { content: [{ type: 'image', data: (await previewOf(out.png, DESIGN)).toString('base64'), mimeType: 'image/jpeg' }, { type: 'text', text: `Done in Canvas (${out.piece.set_title ?? out.piece.template}, ${out.piece.format}): ${out.note}. The person sees it live and can undo it.${theirs}${synced}${tips} Save with save_canvas only when they ask.` }] };
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
          return { content: [{ type: 'text', text: `Saved as a new version. ${linksOf(publicOrigin(ctx), saved.id)}\n${LINKS_NOTE}` }] };
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
        // It saves designs and assets and may call Unsplash or the image models.
        annotations: { readOnlyHint: false, openWorldHint: true },
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
        const m = await loadManifest(template).catch(() => null);
        if (!m) return { isError: true, content: [{ type: 'text', text: `No template "${template}". Templates: ${(await listTemplates()).map((t) => t.id).join(', ')}.` }] };
        let combo;
        try { combo = resolveCombo(m, design, theme); } catch (e) { return { isError: true, content: [{ type: 'text', text: (e as Error).message }] }; }
        const files = comboFormats(m, combo);
        // "All formats" are the social ones: the event page cover is made only when asked for.
        let wanted = formats?.length ? formats : Object.keys(files).filter((f) => f !== 'cover');
        // A format or slot the template does not have is a mistake in the call, said as one (never a
        // "server error, try again").
        const badFormats = wanted.filter((f) => !files[f]);
        if (badFormats.length) return { isError: true, content: [{ type: 'text', text: `${template} has no format ${badFormats.join(', ')}. Formats: ${Object.keys(files).join(', ')}.` }] };
        const badSlots = Object.keys(slots).filter((k) => !m.slots[k]);
        if (badSlots.length) return { isError: true, content: [{ type: 'text', text: `${template} has no slot ${badSlots.join(', ')}. Slots: ${Object.keys(m.slots).join(', ')}.` }] };
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
        // The missing photos' stand-ins, looked for side by side.
        const placeholders: Placeholder[] = await Promise.all(Object.entries(m.slots).filter(([k, s]) => {
          if (s.type !== 'image' || slots[k] || optionalSlots.has(k)) return false;
          if (s.perFormat && !keys.some((f) => f in s.perFormat!)) return false;
          // Made from another photo (the cover's ground from the city photo): that one is filled instead.
          const from = config.derive?.[k]?.from;
          return !(from && (slots[from] || m.slots[from]?.type === 'image'));
        }).map(([k]) => photoPlaceholder({ slot: k, fact: config.facts?.[k] ?? null, slots, purpose: config.purpose, userId: userIdOf(ctx) })));
        if (placeholders.length) slots = { ...slots, ...Object.fromEntries(placeholders.map((p) => [p.slot, p.value])) };
        // Framing that cannot apply is said, never silently dropped.
        const framingNotes: string[] = [];
        for (const [k, f] of Object.entries(framing ?? {})) {
          if (m.slots[k]?.type !== 'image') framingNotes.push(`framing for ${k} ignored: not a photo slot (photo slots: ${Object.keys(m.slots).filter((s) => m.slots[s].type === 'image').join(', ') || 'none'})`);
          else if (!slots[k]) framingNotes.push(`framing for ${k} ignored: it has no photo in this design`);
          else if (f.fill_around && (f.zoom ?? 1) >= 1) framingNotes.push(`fill_around for ${k} ignored: it works only with zoom below 1 (at zoom ${f.zoom ?? 1} the photo already covers its frame)`);
        }
        // Every format checked for its essential content before any is drawn: one that cannot be made never
        // leaves the others saved behind an error (and a retry saving them twice).
        // The cover asked for with the social formats but missing its own content (its ground photo).
        let coverNeeds: string[] | null = null;
        const checks = await Promise.all(wanted.map((format) => prepareFill({ template, format, design, theme, slots, smallerText }, undefined, true).then(() => null, (e: unknown) => ({ format, e }))));
        for (const c of checks) {
          if (!c) continue;
          if (!(c.e instanceof MissingRequired)) return { isError: true, content: [{ type: 'text', text: (c.e as Error).message }] };
          if (c.format === 'cover') {
            coverNeeds = c.e.slots;
            if (wanted.length === 1) return { isError: true, content: [{ type: 'text', text: `The cover needs ${coverNeeds.join(', ')} (the event page cover's own copy). Ask the requester for it, then render formats: ["cover"].` }] };
            wanted = wanted.filter((f) => f !== 'cover');
            continue;
          }
          const have = await factsFromSlots(template, slots);
          // Same purpose first (a booth invite suggests booth invites, not reminders).
          const fits = async (p?: string) => (await matchTemplates(have, p, brand)).filter((x) => x.eligible && x.template !== template).slice(0, 3).map((x) => x.template);
          const same = await fits(config.purpose);
          const alt = same.length ? same : await fits();
          return { isError: true, content: [{ type: 'text', text: `${template} needs ${c.e.slots.join(', ')} (essential content; it never goes out half empty). Nothing was made. Ask the requester for it${alt.length ? `, or use a template that fits what you have: ${alt.join(', ')}` : ''}.` }] };
        }
        const setId = await resolveSet({ userId: userIdOf(ctx), template, slots, requested: set });
        // New pieces of a set that is already filed in a project join that project.
        if (!projectId && supabaseConfigured()) {
          const { data } = await supabaseAdmin().from('renders').select('project_id').eq('set_id', setId).not('project_id', 'is', null).limit(1);
          projectId = (data?.[0]?.project_id as string | undefined) ?? null;
        }
        const origin = publicOrigin(ctx);
        const content: Content[] = [];
        const refused: string[] = [];
        // Formats whose copy fits in smaller text (offered as an option).
        const smallerOption: string[] = [];
        const extendNotes: string[] = [...framingNotes];
        // Each format drawn once, at 2x (the file kept); Claude's preview is a light JPEG of it. Formats are
        // drawn side by side (three at a time), and one that fails never takes the others with it.
        const hiRes = supabaseConfigured();
        type Made = { content: Content[]; refused?: string; smaller?: string; notes: string[]; coverNeeds?: string[]; missing?: MissingRequired; failed?: string; saved?: boolean };
        // fill_around: the same extension asked by two formats is made once, and none starts this late in
        // the call (each can take two minutes; the call has five).
        const started = Date.now();
        const extensions = new Map<string, ReturnType<typeof extendPhoto>>();
        const makeFormat = async (format: string): Promise<Made> => {
          const made: Made = { content: [], notes: [] };
          let out;
          // This format's photos and framing: framing becomes crop edits, and a photo extended with
          // fill_around is this format's own (a new asset) with the crop that keeps it where it was.
          let fslots = slots;
          let fedits: Edits = {};
          try {
            out = await render({ template, format, design, theme, slots, smallerText, framing: asked, scale: hiRes ? 2 : 1 });
            fedits = out.framed;
            const extended: string[] = [];
            for (const [slot, f] of Object.entries(framing ?? {})) {
              const at = f.fill_around ? out.fits[slot] : undefined;
              const plan = at && outpaintFor(at.fit);
              if (!at || !plan || !fslots[slot]) continue;
              if (Date.now() - started > 120_000) { made.notes.push(`${format}: ${slot} not extended this time (no time left in this call; render this format again with the same framing)`); continue; }
              const key = JSON.stringify([slot, fslots[slot], plan.expand]);
              if (!extensions.has(key) && (!owner || !(await useAi(owner, 'outpaint')))) { made.notes.push(`${format}: ${slot} not extended (the daily limit of ${DAILY.outpaint} is reached)`); continue; }
              try {
                if (!extensions.has(key)) extensions.set(key, extendPhoto({ template, image: fslots[slot]!, expand: plan.expand, ownerId: owner!, brand }));
                const ext = await extensions.get(key)!;
                fslots = { ...fslots, [slot]: ext.value };
                fedits = { ...fedits, [at.node]: { crop: plan.cropFor(ext.width, ext.height) } };
                extended.push(slot);
              } catch (e) {
                made.notes.push(`${format}: ${slot} not extended (${(e as Error).message})`);
              }
            }
            if (extended.length) {
              out = await render({ template, format, design, theme, slots: fslots, smallerText, edits: fedits, scale: hiRes ? 2 : 1 });
              made.notes.push(`${format}: ${extended.join(', ')} extended with AI to fill the frame (look at it: it can invent details)`);
            }
          } catch (e) {
            if (e instanceof MissingRequired) {
              // Only the cover is missing its own content (its ground photo): say so, keep the other formats.
              if (format === 'cover' && wanted.length > 1) { made.coverNeeds = e.slots; return made; }
              made.missing = e;
              return made;
            }
            console.error(`render ${template}/${format}`, e);
            made.failed = `${files[format]?.label ?? format}: ${(e as Error).message}`;
            return made;
          }
          const { report, variant, slots: used } = out;
          const png = await previewOf(out.png, DESIGN);
          if (!report.ok) {
            made.refused = `${format}: ` + report.errors.map((e) => `${e.slot ?? e.node}: ${e.message}`).join(' | ');
            // The other option: the same copy in smaller text. A preview only (not saved): the requester
            // chooses, and "smaller text" renders again with smaller_text.
            if (!smallerText) {
              const small = await render({ template, format, design, theme, slots: fslots, edits: fedits, smallerText: true }).catch((e) => { console.error(`smaller text ${template}/${format}`, e); return null; });
              if (small?.report.ok) {
                const shrunk = Object.entries(small.report.slots).filter(([, x]) => x.scale && x.scale < 1).map(([k, x]) => `${k} at ${Math.round(x.scale! * 100)}%`);
                made.content.push({ type: 'image', data: (await previewOf(small.png, DESIGN)).toString('base64'), mimeType: 'image/jpeg' });
                made.content.push({ type: 'text', text: `${files[format]?.label ?? format}: the copy does not fit at the normal size. Option "smaller text" (preview above, not saved): it fits as written with ${shrunk.join(', ') || 'the type reduced'}.` });
                made.smaller = format;
              }
            }
            return made;
          }
          // The 2x file goes to the shared gallery (Supabase) and the link is a signed download.
          // Without Supabase configured, the link re-renders the same piece (every decision explicit).
          const saved = hiRes
            ? await saveRender({
                userId: userIdOf(ctx), template, format, slots: used, png: out.png, width: out.width, height: out.height, scale: 2, projectId, setId, variant: out.variant,
                design: out.design, theme: out.theme, smallerText, ...(Object.keys(fedits).length ? { edits: fedits } : {}),
              })
            : null;
          // Saved: links that last (for people signed in to Studio) until the design is archived or deleted.
          let links: string;
          if (saved) { links = linksOf(origin, saved.id); made.saved = true; }
          else {
            const q = new URLSearchParams({ template, format, scale: '2', ...(combo ? { design: combo.design, theme: combo.theme } : {}), ...(smallerText ? { smaller_text: '1' } : {}) });
            for (const [k, v] of Object.entries(used)) q.set(`slot.${k}`, v ?? '');
            links = `Download (2x PNG): ${origin}/api/render?${q.toString()}`;
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
          made.content.push({ type: 'image', data: png.toString('base64'), mimeType: 'image/jpeg' });
          made.content.push({
            type: 'text',
            text: `${files[format]?.label ?? format}: ready.${notes.length ? ` ${notes.join('. ')}.` : ''} ${links}`,
          });
          return made;
        };
        const results: Made[] = new Array(wanted.length);
        let next = 0;
        await Promise.all(Array.from({ length: Math.min(3, wanted.length) }, async () => {
          while (next < wanted.length) { const i = next++; results[i] = await makeFormat(wanted[i]); }
        }));
        const missing = results.find((r) => r.missing)?.missing;
        if (missing) {
          const have = await factsFromSlots(template, slots);
          // Same purpose first (a booth invite suggests booth invites, not reminders).
          const purpose = (await loadConfig(template)).purpose;
          const brand = await templateBrand(template);
          const fits = async (p?: string) => (await matchTemplates(have, p, brand)).filter((x) => x.eligible && x.template !== template).slice(0, 3).map((x) => x.template);
          const same = await fits(purpose);
          const alt = same.length ? same : await fits();
          return { isError: true, content: [{ type: 'text', text: `${template} needs ${missing.slots.join(', ')} (essential content; it never goes out half empty). Ask the requester for it${alt.length ? `, or use a template that fits what you have: ${alt.join(', ')}` : ''}.` }] };
        }
        const failed: string[] = [];
        for (const r of results) {
          content.push(...r.content);
          if (r.refused) refused.push(r.refused);
          if (r.smaller) smallerOption.push(r.smaller);
          if (r.coverNeeds) coverNeeds = r.coverNeeds;
          if (r.failed) failed.push(r.failed);
          extendNotes.push(...r.notes);
        }
        if (failed.length) {
          if (!content.length && !refused.length && !coverNeeds) return { isError: true, content: [{ type: 'text', text: `Could not render: ${failed.join(' | ')}. Try again in a moment.` }] };
          content.push({ type: 'text', text: `Not made this time (a server error, not the copy): ${failed.join(' | ')}. Render only ${failed.length > 1 ? 'those formats' : 'that format'} again, with the same set.` });
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
        if (results.some((r) => r.saved)) content.push({ type: 'text', text: LINKS_NOTE });
        content.push({ type: 'text', text: `Set: ${setId} (pass it as set to every later render of this brief so the designs stay together in the gallery).` });
        return { isError: refused.length + (coverNeeds ? 1 : 0) === wanted.length && !smallerOption.length, content };
      },
    );
  },
  {
    serverInfo: { name: 'archy-studio', version: plugin.version },
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

// A light JPEG of an image for Claude to look at (the full PNG stays in Assets or the gallery). A design
// gets as much as Claude reads (its small print checked), a photo less; a few hundred KB, never MBs.
const DESIGN = 1568;
async function previewOf(png: Buffer, max = 900): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp(png).resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: max > 900 ? 85 : 80 }).toBuffer();
}
