// For TS scripts run with tsx (warm-previews, review-round): lib code imports Next's request helpers
// (next/navigation, next/headers) that only work inside Next. Outside it they resolve to stand-ins the
// scripts never call. Use: NODE_OPTIONS="--conditions=react-server --import ./scripts/next-stubs.mjs"
import { register } from 'node:module';

register('./next-stubs-hooks.mjs', import.meta.url);
