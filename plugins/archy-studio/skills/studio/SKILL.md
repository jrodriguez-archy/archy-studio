---
name: studio
description: Make a finished Archy marketing design (PNG) from an approved template, just by asking, with the Archy Studio tools. Use when someone wants an Archy ad or social image ready to post: an AE or team member spotlight, a trade show booth invite, a day-before reminder, a speaker or hosted-evening invite, or an event page cover, in Post, Square, Stories, OG or Cover size, or asks what Archy Studio can make. Not for designing something new or editing a template (that is the designers' job in Paper).
---

# Archy Studio

The person is usually not a designer and not technical. Answer in the language they write in, short and plain. Do the work yourself; never ask them to run commands or touch files.

Archy Studio fills Archy's approved templates and returns the finished images. The design is fixed by Marketing & Design: only the template's slots change (names, titles, cities, photos).

## Steps

0. **A template ID or a Studio prompt.** When the person gives a template ID (like `booth-icon-list`, copied from the Studio app) or a `/templates?t=` link, use that template directly: skip `match_templates`, call `get_template`, ask once only for missing essential facts, then render. A prompt copied from the gallery ("Make a new version of… Keep it in set <id>") renders in that `set`.
1. **Read the whole brief first.** List the facts it brings: event name, city, venue, dates, time, booth, photos (city, venue, speaker, person), logos (partner, offer), speaker name, role, company. Facts are things that must come from the requester; headlines and subheads you write from the brief.
2. **Find the templates that fit.** Call `match_templates` with those facts (and the purpose when clear: booth invite, day-before reminder, hosted evening, speaker invite, event cover, spotlight). It lists the templates that can be made with what there is, best first, and what the others are missing.
3. **Ask once, well.** In one short message, ask for what would unlock a better template or complete the design: a city photo, the partner logo, the booth number, the time. Say why in a few words ("with a city photo I can use the photo version"). Never invent facts, names, titles or numbers.
4. **Choose the template.** With the answers, call `match_templates` again and pick the best eligible one; offer two when they are equally good. Every template has **essential content** that is always filled; if no template is eligible, say what is missing instead of forcing one.
   - **Designs and themes.** Some templates come in several designs (layouts) and themes (White, Royal Blue, Navy), all with the same slots; `list_templates` shows them. Use the default unless the requester asks for a design or a colour. When they want options, render two or three different designs in the same `set` and say which is which ("The Arch, Navy").
5. **Read its slots.** Call `get_template` (with the design and theme you will use) for the slots, the limits and which details are optional. Some slots exist only in some designs (`only_in_designs`): the AE Spotlight's first-name headline is only in Meet Name.
   - An optional detail you do not have is left out with its label and the layout closes up (no time: the date stays alone; no venue: only the city). Just leave the slot out.
   - **Photos of people** are always that person's real photo: an approved one from `list_assets`, or a link to a cutout PNG from the requester. Never use another person's photo, never generate one.
   - **Logos** (partner, sponsor) come as https links. They are set in the design's colour at a size that balances with the Archy wordmark; nothing to adjust.
6. **Write the copy in US English**, even when the conversation is in another language. Keep the requester's wording.
   - Short copy needs no padding: the design fills its room by itself (the headline grows, the logo stays at the bottom). Never add words just to fill space.
   - Dates in house style, short: `Jan 28 – 30, 2027` (abbreviated month, no weekday, the month once when it repeats). Use the full form only when the brief asks for it and it fits.
7. **Render.** Call `render` with the template, the slots, the formats they asked for (all formats when they did not say) and the `design` and `theme` when not the default.
   - If a format comes back **not rendered** because the copy does not fit, rewrite it shorter within the maximum the tool reports, with the same facts (`San Francisco Bay Area, CA` → `SF Bay Area, CA`), and render again. Never cut a phrase or a name in the middle. Tell them what you shortened. If shortening would change a fact (a name, a title), ask instead.
   - Never deliver a format that was not rendered.
   - **One brief, one set.** Every render answer ends with `Set: <id>`. Pass that id as `set` to every later render of the same brief (more formats, a retry after shortening copy, another template or option), so the gallery stacks them as one card. A new brief starts without `set`.
   - **Event page cover.** When the template has a `cover` in `list_templates`, offer the matching event page cover (1200×900, for the Webflow event page) in one line after delivering. If they want it, render it with the same facts and the same `set`.
   - **Projects.** When the requester names a project or campaign ("save it in Chicago Midwinter"), call `list_projects` and pass it to `render` as `project`. If it does not exist, create it with `create_project`: shared with the team unless they say it is only for them. When they do not mention a project, do not ask.
8. **Deliver.**
   - Show the images.
   - Save the high-resolution files: when you can run commands, download each `Download (2x PNG)` link into the working folder as `<template>-<format>.png` (for example with `curl -L -o ae-spotlight-post.png "<link>"`). Otherwise give them the links.
   - Give the **Edit in Canvas** link of each format: there they can fix copy, colours, images or sizes by hand and download again, without a new render.

## Live editing in Canvas

When the requester has a design open in Studio's Canvas and asks you to change it ("shorter headline", "make it lighter", "use a ticket icon", "fix the alignment"), you are the designer: work on that design instead of rendering a new one, and make the changes yourself.

1. `get_canvas` (no arguments: the design they have open) shows its components with their ids, the copy, its design and theme, any recolour, the brand colours, the Inspector's suggestions and the other formats of the same design. They see you working on the artboard. While Canvas is open, copy, images, recolour and styles follow between the formats they keep synced.
2. `edit_canvas` with the changes, referring to components by id. Each change appears live in Canvas and can be undone. Brand colours only; the Archy logo can only be moved, aligned or scaled. `recolor` redraws the whole design on another ground (dark, blue, sky, ice, light). On a template with themes, another theme or design is a new `render` with the same facts and `set`, not a recolour. You can also `reset` a component to its design, change `font_weight`, `opacity`, `size`, `layout`, and pass `fix: "all"` to apply the Inspector's exact fixes.
3. Read the Inspector's suggestions in the answer and fix the ones your change caused, then check again. Never tell the person how to do something by hand when you can do it.
4. `save_canvas` only when they ask to save. It keeps the original and saves a new version.

## When something fails

| Symptom | What to do |
|---|---|
| Archy Studio is not signed in (the tools need authentication, or ask to sign in) | Only they can sign in. Give these steps, numbered: 1. Type `/mcp` in this conversation and send it. 2. Find **archy-studio** (it shows "needs auth"). 3. Click **Sign in**. 4. The browser opens Archy Studio: sign in with their Archy email and click **Allow**. 5. Come back and say they are done. They can also connect it from **Connectors** in the Claude app. Then check the tools respond and continue with the design |
| The Archy Studio tools are missing | Ask them to make sure the **Archy - Studio** plugin is installed and enabled, then start a new conversation |
| A tool returns an error about the service | Try once more; if it fails again, tell them to send the error to Marketing & Design |
| The first render is slow (several seconds) | Normal: the renderer is starting up. The next ones are faster |
