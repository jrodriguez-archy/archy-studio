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
3. **Ask once for what is missing.** Ask for every fact the template shows that the request does not give, in one short message. Never invent names, titles, cities or numbers.
   - **Photos of people** are always that person's real photo: an approved one from `list_assets`, or a link the requester gives to a photo with the background removed (a PNG cutout). Never use another person's photo, never generate one. If there is none, say the piece needs it and stop there.
   - A removable block (like the city pill) goes away when there is no value: pass `null`.
4. **Write the copy in US English**, even when the conversation is in another language. Keep the requester's wording.
5. **Render.** Call `render` with the template, the slots and the formats they asked for (all formats when they did not say).
   - If a format comes back **not rendered** because the copy does not fit, shorten the copy to the maximum the tool reports, keeping the meaning (`San Francisco Bay Area, CA` → `SF Bay Area, CA`), and render again. Tell them what you shortened. If shortening would change a fact (a name, a title), ask instead.
   - Never deliver a format that was not rendered.
6. **Deliver.**
   - Show the images.
   - Save the high-resolution files: when you can run commands, download each `Download (2x PNG)` link into the working folder as `<template>-<format>.png` (for example with `curl -L -o ae-spotlight-post.png "<link>"`). Otherwise give them the links.
   - Say in one or two lines what you changed from the request (shortened copy, removed blocks) and what is still pending.

## When something fails

| Symptom | What to do |
|---|---|
| The Archy Studio tools are missing | Ask them to make sure the **Archy - Studio** plugin is installed and enabled, then start a new conversation |
| A tool returns an error about the service | Try once more; if it fails again, tell them to send the error to Marketing & Design |
| The first render is slow (several seconds) | Normal: the renderer is starting up. The next ones are faster |
