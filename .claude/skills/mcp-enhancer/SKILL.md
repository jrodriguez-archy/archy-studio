---
name: mcp-enhancer
description: Improve the Archy Studio MCP from usage diagnostics. Use when the user pastes or points to a diagnostic, transcript, screenshot or complaint about how Claude used the Archy Studio connector (wrong template, invented facts, too many questions, bad render answer, confusing tool output), or asks to review the open MCP findings.
---

# MCP Enhancer

The user pastes diagnostics of real Archy Studio MCP sessions. Each one becomes a finding in `mcp-enhancer/LOG.md` and, when it is worth it, a small change to the MCP. Work on the `mcp-enhancer` branch.

## Where the MCP lives

- `app/mcp/route.ts`: `INSTRUCTIONS` (the server prompt every Claude gets), every tool's description and input schema, and the text each tool answers with.
- `lib/match.ts` (facts, purposes, template matching), `lib/renderer.ts` (render, fit, `MissingRequired`), `lib/templates.ts`, `lib/projects.ts`, `lib/renders.ts`, `lib/canvas-claude.ts` (get/edit/save canvas), `lib/assets.ts`.
- `plugins/archy-studio/skills/studio/SKILL.md`: the skill the plugin ships next to the connector.
- `lib/mcp-auth.ts`: sign-in.

## Loop for each diagnostic

1. **Save it** as `mcp-enhancer/diagnostics/YYYY-MM-DD-<slug>.md`: the raw text as given, plus who/when if known. Never edit the raw part.
2. **Read it as the Claude that used the MCP.** What did it see (instructions, tool descriptions, tool answers) and what did it do? Find the exact moment it went wrong.
3. **Classify the root cause** (one main one):
   - `instructions`: the server prompt is missing, unclear or contradicts itself.
   - `tool-description`: a tool or parameter description misleads or is missing a case.
   - `tool-answer`: a tool's answer text led Claude astray (unclear error, missing next step, too long).
   - `logic`: matching, fit, render or canvas code does the wrong thing.
   - `template`: a template's slots, limits or facts are wrong (fix in `templates/`, not in the prompt).
   - `client`: Claude ignored clear guidance; note it, change nothing unless it repeats.
4. **Pick the smallest fix at the right layer.** Prefer fixing a tool answer or the code over adding more prompt. When the prompt does change, rewrite the sentence that failed instead of appending a new rule; keep `INSTRUCTIONS` short (every Claude pays for it on every call). No patches that only cover the one example.
5. **Check it**: run the dev server (`studio-mcp` in `.claude/launch.json`) and call the tools with `node mcp-enhancer/mcpc.mjs http://localhost:<port>/mcp` (edit the calls at the bottom to reproduce the case). The local MCP needs auth: if the call is refused, use the signed-in flow the user has in Claude instead and say so. For prompt-only changes, re-read the full `INSTRUCTIONS` once to make sure nothing now contradicts.
6. **Log it** in `mcp-enhancer/LOG.md` (newest first): date, diagnostic file, symptom in one line, root cause type, fix (files) or "watching", status (`fixed` / `watching` / `won't fix`). If a `watching` item shows up again, link both and fix it.
7. **Version**: when a change reaches what Claude sees, bump `serverInfo.version` in `app/mcp/route.ts` and add a CHANGELOG line, like the other releases. Commit on the branch; push or merge only when the user asks.

Several diagnostics at once: log them all first, group by root cause, then fix the groups that repeat.

Reply to the user in a few lines: what went wrong, why, what changed (or why nothing did).
