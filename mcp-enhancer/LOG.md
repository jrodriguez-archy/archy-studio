# MCP Enhancer log

Findings from Archy Studio MCP diagnostics, newest first. Raw diagnostics in `diagnostics/`; the loop is in `.claude/skills/mcp-enhancer/SKILL.md`.

Decisions from Juan (2026-10-08), the rules future fixes follow:
- A headline is as big as its room allows; three or four big lines beat two small ones. Never treated as an error.
- A design is never held back by missing photos: placeholders (Unsplash, else AI, else neutral; a person is a neutral silhouette) and Claude asks for the real ones.
- Download links last until the design is archived or deleted (signed-in people).
- Options are different templates (or designs/themes), not copy swaps.
- Dates in each person's own time zone.

| Date | Diagnostic | Symptom | Cause | Fix | Status |
|---|---|---|---|---|---|
| 2026-10-09 | tattoo ad (photo-headline) | Square: the pixel band hid the tattoo, the photo's subject; Claude had to crop the photo by hand and ask for an upload | logic | render takes `framing` per image slot (focus_x / focus_y, zoom; `fill_around` extends the photo with FLUX.2 [pro] Outpaint), saved as crop edits so Canvas opens it as rendered. Canvas: handles and Scale scale the photo inside its frame (⌥ resizes the frame), Generate content around | fixed |
| 2026-10-09 | tattoo ad (photo-headline) | Stories photo stopped loading in Canvas after a while | logic | It was a Notion signed link, stored as given. https photos and logos (render, edit_canvas) are kept in Assets on first use and reused by address (`lib/keep-image.ts`) | fixed |
| 2026-10-09 | tattoo ad (photo-headline) | Claude could not save the PNGs: Download links go through the login | logic | Each format also gives a File link that works without signing in for 7 days (`lib/file-links.ts`); the Download link (signed in) stays the one to share. Skill saves with the File link | fixed |
| 2026-10-09 | tattoo ad (Canvas) | Resizing the frame of a photo that is its own frame (Photo Headline) did nothing | logic | The framing replaced the new size in the same edit (`stage.tsx` dragTo): merged | fixed |
| 2026-10-09 | merge with main | Night Out Scorecard (new): headline ran into the bowling ball (an image, not an SVG) | logic | Illustrations placed as images now count as art copy keeps clear of (`fit.js` artLeaves/leaves). Square now clears the ball but sits close to the score card on 4 lines; Stories pins touch the headline even with the template's own sample copy (a Paper decision: art that gives way to a long headline, or a narrower headline room). Tried measuring the art by its pixels and shrinking instead of wrapping: neither looked right, reverted | for designers |
| 2026-10-09 | browser check | Inspector does not flag the cover's ground photo as a placeholder | logic | The ground is redrawn as a Pixel Tone (a data: image), so its URL no longer says /placeholders/: the photo is marked when filled (`fit.js`), the Inspector reads the mark | fixed |
| 2026-10-08 | phoenix-dinner P10, C6 | Square headline on 3 lines "reported ready" | — | Not a problem (Juan). The headline is no longer held to the sample's line count: `fit.js` withDefaults gives `headline` its room as limit, keeps extra lines only while the column fits its footprint, and wrapping short of an illustration never adds lines when 85% keeps them. Inspector no longer flags a headline's line count. get_template words it as "as many lines as its room allows" | fixed |
| 2026-10-08 | phoenix-dinner (repro) | Stories: date and time refused "collides with Star" | logic | Sparkles never push copy (they hide under text in clearIllustrations): left out of the baseline `clear` list | fixed |
| 2026-10-08 | phoenix-dinner P2, P3, P4 | No photos → only the no-photo template; cover refused for its two photos; render promised a no-photo version that does not exist | logic | `lib/placeholders.ts`: missing photos get placeholders (Unsplash `UNSPLASH_ACCESS_KEY`, else AI via `lib/generate.ts`, else `library/placeholders`; person → silhouette). match_templates no longer counts photos as missing (`photos_to_ask_for`); prepareFill never refuses for a photo; render lists the placeholders; Inspector flags them; dead "no-photo version" text removed | fixed |
| 2026-10-08 | phoenix-dinner P5, C3 | Cover added in Canvas came with the template's Topgolf photo and golf subhead (not in the brief) | logic | Canvas missing formats start with no sample photos or derived lines (`lib/canvas.ts` loadSet); an added format takes what the set holds even where no format draws it (`editor.tsx` addFormats); `cover-subhead` derives from the brief's subhead / perks | fixed |
| 2026-10-08 | phoenix-dinner C1 | Asked for two options, saw one | instructions | Same template + same set: the gallery keeps only the newest per format (`groupSets`). Options are now different templates (placeholders make the photo ones eligible); a copy-only variation goes in its own set | fixed |
| 2026-10-08 | phoenix-dinner P12 | 2x links expire after 7 days | logic | render and save_canvas give `/api/file/<id>`: signed-out → login → download; 404 once archived (the Archive page asks explicitly) | fixed |
| 2026-10-08 | phoenix-dinner P13 | Dates in UTC | logic | `components/local-date.tsx` writes dates in the viewer's zone (gallery, Assets, team); list_assets gives the full timestamp | fixed |
| 2026-10-08 | phoenix-dinner P11 | Assets can only be named, not referenced | Canvas | Assets → detail: Copy ID (first 8 characters of its id); `asset:<id>` resolves team images (`lib/asset-ids.ts`); list_assets returns `id` | fixed |
| 2026-10-08 | phoenix-dinner P7, C2 | Change in one format copied to the others unseen | tool-answer | edit_canvas names the formats a change follows to; instructions: say so, offer to unsync that format, say when formats differ | fixed |
| 2026-10-08 | phoenix-dinner C5 | Photo inserted where Claude guessed | instructions | Canvas: when a change could go in several places, ask once where, in plain words | fixed |
| 2026-10-08 | phoenix-dinner P14 | 4 ToolSearch round trips | client | Studio skill: load every Studio tool in one `ToolSearch select:` | fixed |
| 2026-10-08 | phoenix-dinner P6 | Cover palette changed | — | Juan's own recolour; edit_canvas now says when the person changed the design too | by person |
| 2026-10-08 | phoenix-dinner P9 | OG has no CTA | template | No OG of any template has a CTA in Paper; a design decision for Paper | for designers |
| 2026-10-08 | phoenix-dinner P1, P8 | Not signed in at start; OG 1200×630 vs 628 | — | Fine as is (Juan) | won't fix |
