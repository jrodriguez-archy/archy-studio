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
- `app/mcp`: the MCP server (`list_templates`, `get_template`, `list_assets`, `render`), deployed on Vercel at `https://archystudio.vercel.app/mcp`.
- `app/api/render`: the same renderer over HTTP (used for the 2x download links).
- `templates/<id>`: one folder per template, generated from Paper by `scripts/sync.mjs`.

## Template pipeline (PoC notes)

## Commands
```bash
npm i && npx playwright install chromium
node scripts/sync.mjs templates/ae-spotlight            # read Paper (desktop app open) → post.html, stories.html, manifest.json
node scripts/render.mjs templates/ae-spotlight --calibrate   # measured limits → manifest.json
node scripts/render.mjs templates/ae-spotlight --case cases/long.json   # → out/long-post.png + .json report
python3 scripts/to-srgb.py templates/ae-spotlight/reference/post.png templates/ae-spotlight/reference/post.srgb.png
node scripts/compare.mjs out/original-post.png templates/ae-spotlight/reference/post.srgb.png
```

## Files per template
- `template.config.json`: Paper file and artboard per format (written by hand).
- `rules.json`: fit behaviour designed by hand (bounds, maxLines, minScale, collisions).
- `source/*.json`: raw Paper reads (sync rebuilds offline with `--offline`).
- `manifest.json`: generated slots, defaults, styles and measured limits.

## What we learned about Paper
- The desktop MCP server also listens on `127.0.0.1:29979/mcp`, so a script can read it without going through Claude.
- Paper renders Inter 4 **without optical sizing** (opsz 14 at every size), which needs `font-optical-sizing: none`.
- Exports are **Display P3** with an ICC profile. Convert them to sRGB before diffing.
- Fonts are the same Google Fonts files Paper loads (self-hosted in `fonts/`).
