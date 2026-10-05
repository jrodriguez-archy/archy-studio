---
name: studio
description: Make a finished Archy marketing piece (PNG) from an approved template, just by asking, with the Archy Studio tools. Use when someone wants an Archy ad or social image ready to post, such as an AE or team member spotlight for Instagram or LinkedIn, in Post or Stories size, or asks what Archy Studio can make. Not for designing something new or editing a template (that is the designers' job in Paper).
---

# Archy Studio

The person is usually not a designer and not technical. Answer in the language they write in, short and plain. Do the work yourself; never ask them to run commands or touch files.

Archy Studio fills Archy's approved templates and returns the finished images. The design is fixed by Marketing & Design: only the template's slots change (names, titles, cities, photos).

## Steps

1. **Pick the template.** Call `list_templates` and choose the one whose `use_when` fits the request. If none fits, say so in one line and suggest asking Marketing & Design; do not improvise a design.
2. **Read its slots.** Call `get_template`. Note what is required, what can be removed, and the length limits.
3. **Ask once, then go ahead with what there is.** The templates adapt to the information available, so a missing fact never blocks the piece.
   - In one short message, ask for the facts the request does not give (photo, title, city...) and say what happens without them ("without a title the name card shows only the name; without a city the pill goes away"). If they answer "no", "don't have it" or "go ahead", render with what there is.
   - Missing copy is left out and the layout closes up; a block with nothing left (the city pill, the name plate) disappears; a template with a no-photo version switches to it when there is no photo. All of this is automatic: just leave the slot out.
   - Only what `get_template` marks as `required` is truly needed (for `AE Spotlight`: the name and the photo, since it has no version without a photo yet). If that is missing, say so plainly and offer another template that does not need it, if there is one.
   - Never invent names, titles, cities or numbers, and never use the template's sample text to fill a gap.
   - **Photos of people** are always that person's real photo: an approved one from `list_assets`, or a link the requester gives to a photo with the background removed (a PNG cutout). Never use another person's photo, never generate one; without a real photo, go without.
4. **Write the copy in US English**, even when the conversation is in another language. Keep the requester's wording.
5. **Render.** Call `render` with the template, the slots and the formats they asked for (all formats when they did not say).
   - If a format comes back **not rendered** because the copy does not fit, shorten the copy to the maximum the tool reports, keeping the meaning (`San Francisco Bay Area, CA` → `SF Bay Area, CA`), and render again. Tell them what you shortened. If shortening would change a fact (a name, a title), ask instead.
   - Never deliver a format that was not rendered.
6. **Deliver.**
   - Show the images.
   - Save the high-resolution files: when you can run commands, download each `Download (2x PNG)` link into the working folder as `<template>-<format>.png` (for example with `curl -L -o ae-spotlight-post.png "<link>"`). Otherwise give them the links.
   - Say in one line what was adapted (left out, no-photo version, shortened) and offer to redo it when they get the missing facts or photo.

## When something fails

| Symptom | What to do |
|---|---|
| The Archy Studio tools are missing | Ask them to make sure the **Archy - Studio** plugin is installed and enabled, then start a new conversation |
| A tool returns an error about the service | Try once more; if it fails again, tell them to send the error to Marketing & Design |
| The first render is slow (several seconds) | Normal: the renderer is starting up. The next ones are faster |
