// Before/after check of the MCP guidance: what a Claude sees, and the read-only tool answers it would get.
// NODE_OPTIONS="--import ./mcp-enhancer/no-server-only.mjs" npx tsx mcp-enhancer/guidance-check.ts <command>
//   view <rev|work> <code|connector>   the guidance as that client gets it (rev = a git revision, e.g. HEAD;
//                                       code = Claude Code with the plugin: INSTRUCTIONS cut at 2048 characters
//                                       plus the studio skill; connector = the full INSTRUCTIONS, no skill)
//   match '<facts json>' [purpose] [brand]   match_templates' answer
//   template <id> [design] [theme]           the slots and limits get_template gives
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { matchTemplates } from '../lib/match';
import { loadConfig, loadManifest, listTemplates } from '../lib/templates';

const [cmd, a, b, c] = process.argv.slice(2);
const read = (rev: string, file: string) => (rev === 'work' ? fs.readFileSync(file, 'utf8') : execSync(`git show ${rev}:${file}`, { encoding: 'utf8', maxBuffer: 1 << 24 }));
// Claude Code shows a server's instructions up to 2048 characters.
const CODE_CUT = 2048;

if (cmd === 'view') {
  const route = read(a, 'app/mcp/route.ts');
  const start = route.indexOf('const INSTRUCTIONS = `') + 22;
  const instructions = route.slice(start, route.indexOf('`;', start));
  if (b === 'connector') console.log(`# Server instructions\n\n${instructions}`);
  else console.log(`# Server instructions (as Claude Code shows them)\n\n${instructions.length > CODE_CUT ? `${instructions.slice(0, CODE_CUT)}… [truncated]` : instructions}\n\n# Skill archy-studio:studio\n\n${read(a, 'plugins/archy-studio/skills/studio/SKILL.md')}`);
} else if (cmd === 'match') {
  const all = await matchTemplates(JSON.parse(a), (b || undefined) as never, (c || 'archy') as never);
  const eligible = all.filter((m) => m.eligible).slice(0, 6).map((m) => ({ template: m.template, title: m.title, purpose: m.purpose, shows: m.shows, not_shown: m.unused, ...(m.photos.length ? { photos_to_ask_for: m.photos } : {}) }));
  const almost = all.filter((m) => !m.eligible && m.missing.length <= 2).slice(0, 6).map((m) => ({ template: m.template, title: m.title, needs: m.missing }));
  console.log(JSON.stringify({ eligible, would_fit_with_more_info: almost }));
} else if (cmd === 'template') {
  const m = await loadManifest(a), conf = await loadConfig(a);
  console.log(JSON.stringify({ template: a, title: conf.title, formats: Object.keys(m.formats), designs: m.designs && Object.keys(m.designs), themes: m.themes && Object.keys(m.themes), slots: Object.fromEntries(Object.entries(m.slots).map(([k, s]) => [k, { type: s.type, essential: !(conf.optional ?? []).includes(k), fact: conf.facts?.[k] }])) }));
} else if (cmd === 'list') {
  console.log((await listTemplates((a || 'archy') as never)).map((t) => t.id).join(', '));
}
process.exit(0);
