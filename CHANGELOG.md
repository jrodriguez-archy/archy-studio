# Changelog

## archy-studio 0.17.0 (2026-10-09)

- Canvas: pulling a photo's handle scales the photo inside its frame, from the frame's centre; the frame stays as the template has it. Hold ⌥ to resize the frame instead (as before). The Photo panel’s Scale (was Zoom) does the same, from 20% to 400%, instead of shrinking the whole layer; the photo can be smaller than its frame.
- Canvas: **Generate content around** (Photo panel, when the photo is smaller than its frame): AI paints the rest of the scene so the photo fills its frame again, with the photo where it was. FLUX.2 [pro] Outpaint on fal.ai (`FAL_KEY`), 30 a day per person; the result is also saved in Assets ("generated"). Undo brings the original photo back.

## archy-studio 0.16.0 (2026-10-09)

- Headlines as big as their room allows: a headline is no longer held to its sample's line count (three big lines rather than two small ones), takes extra lines only while the column still fits its room, and wrapping short of an illustration does not add lines when a little less size keeps them. The Inspector no longer flags a headline's line count. Sparkles never push copy (a date "colliding with a star" was refused).
- Missing photos never stop a design: Studio fills them with placeholders close to the brief (Unsplash with `UNSPLASH_ACCESS_KEY`, else one made with AI, else a neutral image; a person's photo is a neutral silhouette, never someone else). Templates with photos are eligible without them; the answer lists the placeholders and Claude asks for the real ones; the Inspector flags them in Canvas. The event page cover is always made; its subhead comes from the brief.
- Canvas: a format added to a set never takes the template's sample photos or lines (another event's venue and golf): it takes what the set holds, else placeholders.
- Download links from Claude last until the design is archived or deleted (`/api/file/<id>`; signed out, it goes through the login first).
- Assets: Copy ID on each image; Claude uses it as `asset:<id>`. Dates show in each person's own time zone.
- MCP: options are different templates, not copy swaps; in Canvas Claude asks where when a change could go in several places, changes only what is asked, and says when synced formats follow a change. The Studio skill loads every tool at once.
## archy-studio 0.15.0 (2026-10-08)

- Two new hosted-evening templates from `Master - Events`, each in Post, Square, Stories, OG and Cover: `night-out-photo-fade` (a venue photo dissolving into the navy ground; needs the venue photo, whose cover reuses it) and `night-out-scorecard` (an activity illustration, bowling by default, as `image-illustration`, and an optional scorecard with `card-player` / `card-total`; its cover asks for a venue photo). Details columns and the card's cells carry their own limits.

## archy-studio 0.14.0 (2026-10-08)

- New template `photo-headline` (Ads, purpose `photo-claim`, "Photo ads"): one product claim told by a photo. Three designs (`full-photo` default, `photo-bottom`, `split`), two themes (`royal` default, `navy`), formats Square 1080×1080, Post 1080×1350 and Stories 1080×1920 (18 artboards in `Master - Ads`, page `Photo Headline`). Slots: `headline` (two lines, grows when the copy is short), `subline` (optional), `cta`, `image-photo`; in Split `image-left`, `image-right` and the optional `label-left` / `label-right`.
- New brief fact `ad-photo` (a scene photo that shows a product claim) for `match_templates`.
- rules.json: a design can now override `fill` (`designs.<design>.fill`), as it already did slots and containers. Photo Bottom uses it so its 115px sample headline does not grow further.

## archy-studio 0.13.0 (2026-10-08)

- Canvas: a photo moves and resizes with its frame (what shows it: its clipping frame, or the frame it fills alone), and its selection shows that frame. Pulling an edge resizes the frame, the photo keeps covering it (framed as it was, then free to reframe), and on a frame placed on the artboard what sits against that edge moves with it (a photo band pushes the photo bar and the content under it). The frame grows only as far as what it pushes can go without leaving the artboard; a frame in a column already moves its neighbours.

## archy-studio 0.12.0 (2026-10-08)

- Canvas: reframe a photo inside its frame. Double-click the photo (or Reframe in the Photo panel), drag to move it, scroll or use the Zoom slider to zoom, arrows to nudge, Enter or Escape when done; the rest of the photo shows faint outside the frame. Reset framing goes back to the automatic framing. Each format keeps its own framing, it is one undo step, it is saved and exported as seen, and a new photo starts from the automatic framing. The old Zoom (scaling frame and photo together) is now Scale, in Advanced. Not on the event page cover's ground, which is already a Pixel Tone of its window.

## archy-studio 0.11.3 (2026-10-08)

- Canvas: a format never empties another format's own content. Editing the Post no longer clears the cover's photos and subhead ("This design cannot go without image-photo, cover-subhead"): a slot is carried only from a format that draws it, and the headline goes from the Post's one line to the cover's two (and back) as it is edited.

## archy-studio 0.11.2 (2026-10-08)

- Canvas opens again in production: its pages now carry the asset library list and the template files ("ENOENT … library/library.json").

## archy-studio 0.11.1 (2026-10-08)

- Event page covers take the Pixel Tone of their template's ground, as in Paper: navy on Booth Invite Photo (Navy), Night Out Illustration and Night Out Venue, royal blue on Booth Icon List, Speaker Invite and Booth Invite Photo (Royal Blue), ice on Booth Light Rulers and Booth Photo Band (`coverTone` / `coverTones` per theme in rules.json). Before, every cover came out royal blue.

## archy-studio 0.11.0 (2026-10-08)

- Event page covers are a format of their event template, as in Paper: `booth-icon-list`, `booth-invite-photo` (Navy and Royal Blue), `booth-light-rulers`, `booth-photo-band`, `night-out-illustration`, `night-out-venue` and `speaker-invite` gain a `cover` format (1200×900). The seven `event-cover-*` templates are gone; old `?t=event-cover-*` links open their template with the cover in front.
- The cover fills itself from the event's facts: the headline splits in two (`derive` with `line`), the booth prints "Booth #412" where the format's own sample does (per-format `sample` in the manifest), and the city photo of the photo templates becomes its ground. What only the cover needs (its ground photo, a guest photo, `cover-subhead` on the Night Out covers) is asked for only when the cover is made: `get_template` shows it as `only_in_formats`, and `coverEssential` in the config feeds `match_templates` with purpose `event-cover`.
- `render` with no formats makes the social ones; the cover is made with `formats: ["cover"]`. Asked together and missing its photo, the cover is skipped with what it needs instead of failing the whole call.

## archy-studio 0.10.1 (2026-10-08)

- Template guidance no longer mentions offer logos, and the brief facts drop `offer` and `offer-logo` (no template uses them since 0.10.0).

## archy-studio 0.10.0 (2026-10-08)

- Event templates synced from Paper: every ground is now a Pixel Gradient, Rulers are 3px on it and photo bands end in a photo bar; Night Out Illustration has loose `Star` layers, Night Out Venue no drinks pattern.
- Templates merged into themes (Navy, Royal Blue): `booth-invite-offer` is now the Royal Blue theme of `booth-invite-photo`, `countdown-offer` of `countdown-mascot`, `event-cover-booth-offer` of `event-cover-booth-photo`. The three old ids are gone (no offer slot any more); designs made with them no longer open.
- Fit engine: loose `Star` layers are treated as sparkles (hidden when they touch a text), not as an obstacle the copy has to wrap around.

## archy-studio 0.9.0 (2026-10-08)

- Copy that does not fit gets options instead of a plain refusal: **shorter copy** (with the exact maximum) or **smaller text**, a preview of the same copy with the type reduced to fit (down to 70%, never under 14px). The requester chooses; `render` takes `smaller_text: true` for the second, and the design remembers it (Canvas and later renders keep the smaller text).
- Template QA and review rounds go through every design and theme of templates that offer several; Template review names them ("Post · The Arch, Navy").

## archy-studio 0.8.0 (2026-10-08)

- Designs and themes: the AE Spotlight comes in five designs (Meet Name, The Arch, Grid Card, Mosaic, Forum) and three themes (White, Royal Blue, Navy), 30 artboards from the `Master - Ads` file. `render`, `get_template` and the render API take an optional `design` and `theme`; the default is Meet Name in White, so nothing changes for designs made before.
- `list_templates` lists each template's designs and themes; `get_template` gives the limits of the design and theme asked for and marks slots that only some designs have (`only_in_designs`).
- Designs remember their design and theme: Canvas, sets, the gallery stack and set downloads keep options in other designs apart.
- Studio app: design and theme pickers in the template inspector (preview, copied prompt and Start in Canvas follow them), a design × theme grid on the template page, and pickers in Canvas's Library.
- Canvas: the whole-design recolour is now `recolor` in `edit_canvas` (it was `theme`), so it is not confused with a template's themes.
- AE Spotlight: the location pill's length limit is its real room (about 20 characters in Post, 29 in Stories).

## archy-studio 0.7.0 (2026-10-08)

- Canvas tools: `get_canvas`, `edit_canvas` and `save_canvas` let Claude edit, live, the design open in Studio's Canvas (copy, colours, theme, icons, images, sizes, layout, `fix: "all"` for the Inspector's fixes), as the designer: it fixes what its change causes instead of asking the person to do it by hand.
- Every render answer gives an **Edit in Canvas** link for each format.
- `get_canvas` lists the other formats of the design; in Canvas they stay in sync (copy, images, theme and styles).
- Short copy needs no padding: designs fill their room by themselves. Copy that does not fit is rewritten shorter with the same facts, never cut; dates in house style (`Jan 28 – 30, 2027`).
- "Design" instead of "piece" wherever people read it.

## archy-studio 0.6.0 (2026-10-06)

- Event page covers belong to their style: `list_templates` shows `cover` (and `cover_of` on covers). After a style with a cover, Claude offers the matching cover and renders it in the same set.
- Template IDs: a template ID or a Studio template link goes straight to that template (no matching). Prompts copied from the Studio gallery keep the new version in the same set.
- Sets: everything made from one brief (its formats, retries and options) is one stacked card in the gallery. `render` answers with `Set: <id>` and takes an optional `set`; without it, a retry of the same template and headline within 30 minutes joins the same set. New pieces of a set already in a project join that project.

## archy-studio 0.5.1 (2026-10-05)

- When Archy Studio is not signed in, Claude gives the same five steps to connect it (`/mcp`, archy-studio, Sign in, Allow in the browser, come back), in Claude Code, the desktop app and Cowork.

## archy-studio 0.5.0 (2026-10-05)

- Projects: pieces can be filed into project folders in the Studio gallery, shared with the team or personal. New tools `list_projects` and `create_project`; `render` takes an optional `project`. Claude only files pieces when the requester names a project.

## archy-studio 0.4.0 (2026-10-05)

- Brief first: Claude reads the whole brief, lists its facts and calls the new `match_templates` tool, which returns the templates that can be made with them (best first) and what the others are missing. It asks once for what would unlock a better template, then chooses.
- Every template has essential content and minor optional details: a template never goes out half empty. Without its essentials the render is refused with alternatives of the same purpose; an optional detail is left out with its label (no time: the date stays alone).
- Partner and offer logos are sized optically: same visible ink as the Archy wordmark, measured without the file's transparent margins, within the room the design gives them, centred and in one colour.

## archy-studio 0.3.0 (2026-10-05)

- 19 new templates from `Master - Events` (52 formats): booth invites (Icon List, Invite Photo, Invite Offer, Light Rulers, Photo Band), day-before reminders (Countdown Mascot, Masthead, Offer), Speaker Invite, Night Out (Illustration, Venue) and the eight Event Covers. Post, Square, Stories and OG, each within 0.5% of its Paper export (one OG at 0.7%, antialiasing only).
- Missing facts adapt every template: the value goes with its label (`Booth` + `#1039`), separators left over are removed, and an image or logo without a link is left out.
- Partner and offer logos by https link, set at the design's height.
- Each copy slot reports its own exact maximum when it does not fit; one long slot no longer blocks the others.

## archy-studio 0.2.1 (2026-10-05)

- `AE Spotlight` no-photo version withdrawn (a full-width design without a photo will come later): the template needs the person's photo again. Missing title, city or name card copy still adapt the layout.

## archy-studio 0.2.0 (2026-10-05)

- Pieces adapt to the information available instead of refusing: missing copy is left out and the layout closes up, a block left empty (city pill, name plate) disappears, and a missing photo switches to the template's no-photo version.
- `AE Spotlight` gets a no-photo version (Post and Stories): the name card becomes the centre of the blue panel. The first name is derived from the full name when not given. Only the name is truly required.
- The `studio` skill asks once for missing facts, says what the piece will look like without them, then goes ahead.
- The city pill is set uppercase by the design (it was typed in capitals before).

## archy-studio 0.1.1 (2026-10-05)

- Missing facts: the service refuses a render when any copy slot is left out (it used to keep the template's sample copy); the `studio` skill asks for every missing fact in one message and removes optional blocks only when the fact does not exist.

## archy-studio 0.1.0 (2026-10-05)

- First release: ask for a piece and get the finished PNG from an approved template. Connects the Archy Studio service (`list_templates`, `get_template`, `list_assets`, `render`).
- First template: `AE Spotlight` (Post 1080×1080, Stories 1080×1920). Copy that does not fit is refused with the exact maximum, so it is shortened and rendered again, never delivered overflowing.
- `studio` skill: pick the template, ask once for missing facts, copy in US English, real photos only, save the 2x PNGs.
