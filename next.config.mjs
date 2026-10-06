// Template HTML, assets, fonts, the asset library and the fit engine are read from disk at runtime.
const renderFiles = [
  './templates/**/*', './fonts/**/*', './library/**/*', './scripts/fit.js',
  './node_modules/@sparticuz/chromium/bin/**', './node_modules/playwright-core/**',
];
const notNeeded = ['./templates/*/reference/**', './templates/*/source/**'];

/** @type {import('next').NextConfig} */
export default {
  // Chromium and Playwright stay as runtime node_modules, not bundled.
  serverExternalPackages: ['@sparticuz/chromium', 'playwright-core', 'sharp'],
  outputFileTracingIncludes: { '/api/render': renderFiles, '/mcp': renderFiles, '/api/preview/[template]/[format]': renderFiles },
  outputFileTracingExcludes: { '/api/render': notNeeded, '/mcp': notNeeded, '/api/preview/[template]/[format]': notNeeded },
};
