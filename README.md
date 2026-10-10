# Archy Studio

Claude plugin and service for Archy's marketing team: ask for a piece ("an Instagram ad introducing Sarah, our AE in Austin") and get the finished PNG, built from templates approved by Marketing & Design.

## Install the plugin (Claude app, Cowork or Code)

1. **+ → Plugins → Add marketplace**, and enter `jrodriguez-archy/archy-studio`.
2. Install **Archy - Studio**.
3. Start a new conversation and ask for a piece.

Claude Code in a terminal:

```bash
claude plugin marketplace add jrodriguez-archy/archy-studio
claude plugin install archy-studio@archy-studio
```

## How it is built

- `plugins/archy-studio`: the plugin (MCP connection + `studio` skill), listed by `.claude-plugin/marketplace.json`.
- `app/mcp`: the MCP server (`list_templates`, `get_template`, `match_templates`, `render`, `list_assets`, `request_photos`, `get_photos`, `report_missing_template`, `get_brand_kit`, `compose`, `generate_image`, `pixel_tone`, `list_projects`, `create_project`, `get_canvas`, `edit_canvas`, `save_canvas`), deployed on Vercel at `https://archystudio.vercel.app/mcp`.
- `app/(app)/docs`: the in-app Docs (content in `components/docs/sections`, index in `lib/docs.ts`; screenshots from `scripts/docs-shots.ts`).
- Versions: Studio's version is the plugin's (`plugin.json`, shown in the account menu). A release raises it in `plugin.json` and `marketplace.json`, adds its `CHANGELOG.md` entry and its plain-words entry in `lib/whats-new.ts` (the Docs page What's new). An open Studio shows **Update** when a newer deploy is out (`/api/version`).
- `app/api/render`: the same renderer over HTTP (used for the 2x download links).
- `templates/<id>`: one folder per template, generated from Paper by `scripts/sync.mjs`.

## Template pipeline (PoC notes)

## Commands
```bash
npm i && npx playwright install chromium
node scripts/sync.mjs templates/ae-spotlight            # read Paper (desktop app open) → post.html, stories.html, manifest.json
node scripts/render.mjs templates/ae-spotlight --calibrate   # measured limits → manifest.json
node scripts/render.mjs templates/ae-spotlight --case cases/long.json   # → out/long-post.png + .json report
node scripts/render.mjs templates/ae-spotlight --case cases/long.json --design the-arch --theme navy   # one design × theme
node scripts/render.mjs templates/ae-spotlight --case cases/long.json --combos all   # every design × theme
python3 scripts/to-srgb.py templates/ae-spotlight/reference/post.png templates/ae-spotlight/reference/post.srgb.png
node scripts/compare.mjs out/original-post.png templates/ae-spotlight/reference/post.srgb.png
```

## Files per template
- `template.config.json`: Paper file and artboard per format (written by hand). A template with several designs and themes adds `designs`, `themes`, `default` and `combos` (`<design>--<theme>` → artboard per format); `formats` is the default combo. Files of a combo are `<format>--<design>--<theme>.html`.
- `rules.json`: fit behaviour designed by hand (bounds, maxLines, minScale, collisions, `inset` per format). `designs.<design>` replaces the slot rules (and containers) it names for that design; themes share their design's rules.
- `source/*.json`: raw Paper reads (sync rebuilds offline with `--offline`).
- `manifest.json`: generated slots, defaults, styles and measured limits.

## What we learned about Paper
- The desktop MCP server also listens on `127.0.0.1:29979/mcp`, so a script can read it without going through Claude.
- Paper renders Inter 4 **without optical sizing** (opsz 14 at every size), which needs `font-optical-sizing: none`.
- Exports are **Display P3** with an ICC profile. Convert them to sRGB before diffing.
- Fonts are the same Google Fonts files Paper loads (self-hosted in `fonts/`).

## Explorations: brand kit
- `brand-kit/archy/`: the guide Claude reads (`kit.md`), tokens, the wordmark, the pixel gradients (`textures/`, from archy-design's `pixel.py gradient png all --size 4000x4000`) and the product screens (`product/`, `product.json`).
- Product screens come from Paper › Master - Product, the `TPL · … · Desktop 2056×1160` artboards exported at 2x and converted to sRGB WebP (Paper exports Display P3). Paper renders only the open file: open Master - Product before exporting. When a screen changes, export it again under the same name; crops in `product.json` are in screen px.
