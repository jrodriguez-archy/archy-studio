// Template HTML, assets, fonts, the asset library and the fit engine are read from disk at runtime.
const renderFiles = [
  './templates/**/*', './fonts/**/*', './library/**/*', './scripts/fit.js', './scripts/edits.js', './scripts/components.js',
  './node_modules/@sparticuz/chromium/bin/**', './node_modules/playwright-core/**',
];
// Routes that render with Chromium (Canvas export and save go through /api/canvas).
const rendering = ['/api/render', '/mcp', '/api/preview-render/[template]/[format]', '/api/canvas'];
const notNeeded = ['./templates/*/reference/**', './templates/*/source/**'];
// Pages that only list templates and designs read manifests and configs, never template images.
const listing = ['/', '/archive', '/projects/[id]', '/templates', '/templates/[id]', '/admin', '/admin/review', '/account', '/install',
  '/api/preview/[template]/[format]', '/api/file/[id]', '/api/sets/[id]/zip', '/api/uploads', '/api/icons'];
const noImages = [...notNeeded, './templates/*/assets/**', './templates/*/*.{png,jpg,jpeg,webp,svg}', './library/**'];

/** @type {import('next').NextConfig} */
export default {
  agentRules: false,
  devIndicators: { position: 'bottom-right' },
  // Chromium and Playwright stay as runtime node_modules, not bundled.
  serverExternalPackages: ['@sparticuz/chromium', 'playwright-core', 'sharp'],
  outputFileTracingIncludes: { ...Object.fromEntries(rendering.map((r) => [r, renderFiles])), '/api/preview/[template]/[format]': ['./templates/*/manifest.json', './scripts/fit.js', './scripts/edits.js'] },
  // Paper references and sources are for designers, never read by the app: no function carries them.
  outputFileTracingExcludes: { '**': notNeeded, ...Object.fromEntries(listing.map((r) => [r, noImages])) },
  experimental: { optimizePackageImports: ['@hugeicons/core-free-icons'] },
};
