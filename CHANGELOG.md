# Changelog

## archy-studio 0.1.1 (2026-10-05)

- Missing facts: the service refuses a render when any copy slot is left out (it used to keep the template's sample copy); the `studio` skill asks for every missing fact in one message and removes optional blocks only when the fact does not exist.

## archy-studio 0.1.0 (2026-10-05)

- First release: ask for a piece and get the finished PNG from an approved template. Connects the Archy Studio service (`list_templates`, `get_template`, `list_assets`, `render`).
- First template: `AE Spotlight` (Post 1080×1080, Stories 1080×1920). Copy that does not fit is refused with the exact maximum, so it is shortened and rendered again, never delivered overflowing.
- `studio` skill: pick the template, ask once for missing facts, copy in US English, real photos only, save the 2x PNGs.
