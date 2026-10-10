// Repro scripts outside Next: `server-only` resolves to nothing
// (NODE_OPTIONS="--import ./mcp-enhancer/no-server-only.mjs" npx tsx …).
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true };
  return next(spec, ctx);
}`));
