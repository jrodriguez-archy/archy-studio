---
name: studio
description: Make a finished Archy marketing design (PNG) from an approved template, just by asking, with the Archy Studio tools. Use when someone wants an Archy ad or social image ready to post: an AE or team member spotlight, a photo-led ad with one product claim, a trade show booth invite, a day-before reminder, a speaker or hosted-evening invite, or an event page cover, in Post, Square, Stories, OG or Cover size, or asks what Archy Studio can make. Also explorations in the Archy brand when no template covers the brief. Not for editing a template (that is the designers' job in Paper).
---

# Archy Studio

The person is usually not a designer and not technical. Answer in the language they write in, short and plain. Do the work yourself; never ask them to run commands or touch files.

Archy Studio fills Archy's approved templates and returns the finished images. The design is fixed by Marketing & Design: only the template's slots change (names, titles, cities, photos).

## Steps

When the Archy Studio tools are deferred (they appear only by name), load them all at once with one `ToolSearch` call: `select:` followed by every Archy Studio tool name (match_templates, get_template, list_templates, list_assets, render, request_photos, get_photos, report_missing_template, get_brand_kit, compose, generate_image, pixel_tone, get_canvas, edit_canvas, save_canvas, list_projects, create_project), not one at a time.

0. **A template ID or a Studio prompt.** When the person gives a template ID (like `booth-icon-list`, copied from the Studio app) or a `/templates?t=` link, use that template directly: skip `match_templates`, call `get_template`, ask once only for missing essential facts, then render. A prompt copied from the gallery ("Make a new version of… Keep it in set <id>") renders in that `set`.
1. **Read the whole brief first.** List the facts it brings: event name, city, venue, dates, time, booth, photos (city, venue, speaker, person), logos (partner, offer), speaker name, role, company. Facts are things that must come from the requester; headlines and subheads you write from the brief.
2. **Find the templates that fit.** Call `match_templates` with those facts (and the purpose when clear: booth invite, day-before reminder, hosted evening, speaker invite, event cover, spotlight, photo ad (`photo-claim`: one product claim told by a photo); `event cover` finds the event templates whose cover format can be made). It lists the templates that can be made with what there is, best first, and what the others are missing.
3. **Ask once, well.** In one short message, ask for what would complete the design: the partner logo, the booth number, the time. Never invent facts, names, titles or numbers.
   - **Photos never hold a design back.** A template with photos is made anyway: missing photos come as placeholders close to the brief (a neutral silhouette for a person), and you ask for the real ones in the same message (`photos_to_ask_for`). They can send a link, upload the photo in Studio → Assets and give you its ID, or swap it in Canvas.
4. **Choose the template.** With the answers, call `match_templates` again and pick the best eligible one; offer two when they are equally good. Every template has **essential content** that is always filled; if no template is eligible, say what is missing instead of forcing one.
   - **No template for it.** When the kind of piece or the size is not in the catalog (a LinkedIn banner, a flyer, an email header), even if some template is eligible by its facts: offer the closest template adapted, in one line (`closest_made_for_another_purpose`, or a format they can use instead), and make it if they take it. If nothing is close, or they decline it, call `report_missing_template` once (so Marketing & Design see what is asked for) and, in the same message, offer an **exploration** (below). When they asked to explore in the first place, skip this and go straight to the exploration. Never promise a date for a template.
   - **Options are different designs.** When they ask for options, make each one a different template (or design or theme), not the same design with other copy. A copy-only variation only when they ask for it, rendered without `set` so it shows on its own in the gallery.
   - **Designs and themes.** Some templates come in several designs (layouts) and themes (White, Royal Blue, Navy), all with the same slots; `list_templates` shows them. Use the default unless the requester asks for a design or a colour. When they want options, render two or three different designs in the same `set` and say which is which ("The Arch, Navy").
5. **Read its slots.** Call `get_template` (with the design and theme you will use) for the slots, the limits and which details are optional. Some slots exist only in some designs (`only_in_designs`): the AE Spotlight's first-name headline is only in Meet Name, and the Photo Headline's two photos and labels only in Split.
   - An optional detail you do not have is left out with its label and the layout closes up (no time: the date stays alone; no venue: only the city). Just leave the slot out.
   - **Photos of people** are always that person's real photo: one the team added to Studio (`list_assets`, or the ID they copy from Assets as `asset:<id>`; a cutout without background works best), or a link to a cutout PNG from the requester. Never use another person's photo, never generate one; until it comes, a neutral silhouette holds its place.
   - **Logos** (partner, sponsor) come as https links. They are set in the design's colour at a size that balances with the Archy wordmark; nothing to adjust.
6. **Write the copy in US English**, even when the conversation is in another language. Keep the requester's wording.
   - Short copy needs no padding: the design fills its room by itself (the headline grows, the logo stays at the bottom). Never add words just to fill space. A headline on three or four big lines is right.
   - Dates in house style, short: `Jan 28 – 30, 2027` (abbreviated month, no weekday, the month once when it repeats). Use the full form only when the brief asks for it and it fits.
7. **Render.** Call `render` with the template, the slots, the formats they asked for (all formats when they did not say; "all" never includes the event page cover) and the `design` and `theme` when not the default.
   - If a format comes back **not rendered** because the copy does not fit, give them the choice, in one short message:
     - **Shorter copy**: your rewrite within the maximum the tool reports, same facts (`San Francisco Bay Area, CA` → `SF Bay Area, CA`). Never cut a phrase or a name in the middle.
     - **Smaller text**: when the answer includes its preview, show it and say how much the text shrank ("the name at 81%"). It keeps their wording.
     Render what they choose: the shorter copy, or the same copy with `smaller_text: true`. When smaller text does not fit either, only shorter copy works: say so, and ask before changing a fact (a name, a title).
   - Never deliver a format that was not rendered.
   - **Look at every photo.** When what matters in a photo (a face, a tattoo, a product) is cut off or hidden behind the design (the pixel band, the copy), render again with `framing` for that slot: `focus_x` / `focus_y` (0–100 %, where the subject is in the photo) keep it at the frame's centre; `zoom` above 1 comes closer. When the photo is too tall or too wide to show the subject whole, use `zoom` below 1 with `fill_around: true`: AI paints the rest of the scene around it (look at the result, and tell them it was extended; it can invent details). The framing stays in the design, so Canvas opens it as rendered.
   - **Photo links.** An https photo (Notion, Drive, any signed link) is kept in Assets the first time it is used, so the design keeps working once the link expires. If the link no longer opens, ask for the photo with `request_photos`.
   - **One brief, one set.** Every render answer ends with `Set: <id>`. Pass that id as `set` to every later render of the same brief (more formats, a retry after shortening copy, another template or option), so the gallery stacks them as one card. A new brief starts without `set`.
   - **Event page cover.** When the template has a `cover` format in `list_templates`, offer the event page cover (1200×900, for the Webflow event page) in one line after delivering. If they want it, render the same template with `formats: ["cover"]`, the same facts, design, theme and `set`. It splits the headline and prints "Booth" by itself. Its own photos (`only_in_formats: ["cover"]`) come as placeholders when there are none yet; its short `cover-subhead` is written from the brief.
   - **Projects.** When the requester names a project or campaign ("save it in Chicago Midwinter"), call `list_projects` and pass it to `render` as `project`. If it does not exist, create it with `create_project`: shared with the team unless they say it is only for them. When they do not mention a project, do not ask.
8. **Deliver.**
   - Show the images.
   - Save the high-resolution files: when you can run commands, download each format's **File** link (it works without signing in for 7 days) into the working folder as `<template>-<format>.png` (for example with `curl -L -o ae-spotlight-post.png "<File link>"`). Otherwise give them the links.
   - Give the **Edit in Canvas** link of each format: there they can fix copy, colours, images or sizes by hand and download again, without a new render.
   - Say which photos are placeholders and how to replace them. Give the **Download (2x PNG)** links to share: they last (for people signed in to Studio) until the design is archived or deleted.

## Explorations (Archy only)

A new design outside the templates. It is not an approved template: it goes to the gallery labelled Exploration and Design reviews it. Say so plainly.

- **When.** When they ask to explore, for something new or without a template ("explore", "something different"), go straight to it, without `match_templates`. Otherwise it comes after the closest template, when nothing fits or they decline it.

1. Call `get_brand_kit` once: formats and safe areas, tokens, grounds and textures, type scale, and the pieces to copy (logo, button, pill, label and value, rulers, photo, scrim, Pixel Dissolve, Pixels Behind).
2. **Decide the kind of piece:**
   - **Image-led**: a photo fills the artboard and is the subject; the copy sits on its calm part on a **scrim** (white behind dark text, navy behind white text, fading toward the subject).
   - **Typographic**: the headline is the design and holds the centre, on a colour ground, a pixel gradient or a Pixel Tone place as atmosphere.
   Never a band of photo stopping mid-piece, never a hole.
3. Call `compose` with the format they need; more formats only when asked. The real logo always through `data-piece="logo"`.
4. **Look at every image as a designer would**: hierarchy; type bigger than feels safe (a post headline from 120 px, bigger when it has room); the **logo with its own air** (half its height clear all around, usually at the other end from the headline) and at full size; a person big and bleeding off the bottom (on a colour ground it often reads best pushed right and bleeding off the right edge, with the logo in the free bottom-left corner and no pixels under it; Pixel Dissolve is optional); subjects in a photo framed large and close under the headline, never behind it; leading open enough that descenders never meet the next line; the safe area; nothing floating. These are guides: use them when they fit. **Sky is never a ground**, only an accent. A format that breaks a hard rule (logo, fonts, text cut, overlapping or without a scrim on a photo, a photo cutting across the piece, a hole, contrast, tiny text) comes back not saved with the problems: fix them and `compose` again with the same `set`.
5. **Options are different compositions** (image-led or typographic, ground, where the copy sits), not the same one with other copy.
6. **Images**: a real photo first (`list_assets`, or the requester's); a specific person (an AE, a speaker) is always their real photo. Otherwise `generate_image` for the whole artboard, with `copy_space` where the copy goes and a prompt written as an art director: an **editorial, magazine-quality moment** (a subject large and close, something happening, framing and light), never an empty room or a lone object. Generic people are fine; never a specific real person, a real venue as itself or a logo. Make one, look at it, then another if needed (there is a daily limit). Tell them which images are AI-generated.
7. **Textures**, as Archy's brand defines them: a pixel gradient for a colour ground, **Pixel Dissolve** for a person bleeding off the bottom, **Pixels Behind** for a tight headshot, **Pixel Tone** (`pixel_tone`) for a place behind type (never on people, never on the subject).
8. Never invent facts; copy in US English. The mascot and DOC are not in explorations yet.
9. Deliver as with templates: the images, the File links saved to the folder, the Download links to share and the **Edit in Canvas** link. Small changes are made in Canvas, by them or by you with `get_canvas` / `edit_canvas`; a new layout, ground or format is a new `compose` with the same `set`. A recolour preset does not repaint a pixel texture.

## Live editing in Canvas

When the requester has a design open in Studio's Canvas and asks you to change it ("shorter headline", "make it lighter", "use a ticket icon", "fix the alignment"), you are the designer: work on that design instead of rendering a new one, and make the changes yourself.

1. `get_canvas` (no arguments: the design they have open) shows its components with their ids, the copy, its design and theme, any recolour, the brand colours, the Inspector's suggestions and the other formats of the same design. They see you working on the artboard. While Canvas is open, copy, images, recolour and styles follow between the formats they keep synced.
2. `edit_canvas` with the changes, referring to components by id. Each change appears live in Canvas and can be undone. Brand colours only; the Archy logo can only be moved, aligned or scaled. `recolor` redraws the whole design on another ground (dark, blue, ice, light). On a template with themes, another theme or design is a new `render` with the same facts and `set`, not a recolour. You can also `reset` a component to its design, change `font_weight`, `opacity`, `size`, `layout`, and pass `fix: "all"` to apply the Inspector's exact fixes.
3. Read the Inspector's suggestions in the answer and fix the ones your change caused, then check again. Never tell the person how to do something by hand when you can do it.
   - When a change could go in more than one place (a photo, on a design with a ground photo and a guest photo), ask once where, in plain words, before making it.
   - Change only what they ask. Copy that does not come from the brief (a template sample, another event's details) is pointed out with a version from the brief, not rewritten on your own.
   - When they ask for a change in one format only, say the synced formats change too unless they unsync it (its label in Canvas), and say when formats end up different.
4. `save_canvas` only when they ask to save. It keeps the original and saves a new version.

## When something fails

| Symptom | What to do |
|---|---|
| Archy Studio is not signed in (the tools need authentication, or ask to sign in) | Only they can sign in. Give these steps, numbered: 1. Type `/mcp` in this conversation and send it. 2. Find **archy-studio** (it shows "needs auth"). 3. Click **Sign in**. 4. The browser opens Archy Studio: sign in with their Archy email and click **Allow**. 5. Come back and say they are done. They can also connect it from **Connectors** in the Claude app. Then check the tools respond and continue with the design |
| The Archy Studio tools are missing | Ask them to make sure the **Archy - Studio** plugin is installed and enabled, then start a new conversation |
| A tool returns an error about the service | Try once more; if it fails again, tell them to send the error to Marketing & Design |
| The first render is slow (several seconds) | Normal: the renderer is starting up. The next ones are faster |
