// Template HTML, assets, fonts, the asset library and the fit engine are read from disk at runtime.
const renderFiles = [
  './templates/**/*', './fonts/**/*', './library/**/*', './scripts/fit.js', './scripts/edits.js', './scripts/components.js',
  './node_modules/@sparticuz/chromium/bin/**', './node_modules/playwright-core/**',
];
// Routes that render with Chromium (Canvas export and save go through /api/canvas).
const rendering = ['/api/render', '/mcp', '/api/preview/[template]/[format]', '/api/canvas'];
const notNeeded = ['./templates/*/reference/**', './templates/*/source/**'];

/** @type {import('next').NextConfig} */
export default {
  agentRules: false,
  devIndicators: { position: 'bottom-right' },
  // Chromium and Playwright stay as runtime node_modules, not bundled.
  serverExternalPackages: ['@sparticuz/chromium', 'playwright-core', 'sharp'],
  outputFileTracingIncludes: Object.fromEntries(rendering.map((r) => [r, renderFiles])),
  outputFileTracingExcludes: Object.fromEntries(rendering.map((r) => [r, notNeeded])),
};
