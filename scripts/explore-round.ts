// A new Exploration review round: the team's explorations (not archived) as they are, the newest of
// each format in each set, for an admin to evaluate in Studio (Admin → Review → Explorations). Nothing
// is rendered again; each item points at the existing PNG. Sets already in a round are left out.
//
//   set -a; source .env.local; set +a; npx tsx scripts/explore-round.ts [--since 2026-10-01] [--brand archy|doc] [--note "..."]
//
// Without --since: what was made since the last exploration round (or in the last two weeks).
import { isBrand } from '../lib/brands';
import { createExplorationRound } from '../lib/explore-round';

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };

async function main() {
  const brand = arg('brand');
  if (brand && !isBrand(brand)) throw new Error('--brand is archy or doc');
  const since = arg('since');
  if (since && Number.isNaN(Date.parse(since))) throw new Error(`Not a date: ${since}`);
  const out = await createExplorationRound({ since: since ? new Date(since).toISOString() : undefined, brand: brand && isBrand(brand) ? brand : undefined, note: arg('note') ?? null });
  console.log(out.count ? `Exploration round ${out.number}: ${out.count} designs.` : 'No new explorations to review.');
  process.exit(0);
}

main().catch((e) => { console.error((e as Error).message); process.exit(1); });
