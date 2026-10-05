# Changelog

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
