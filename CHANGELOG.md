# Changelog

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
