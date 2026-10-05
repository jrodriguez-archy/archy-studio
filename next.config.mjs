/** @type {import('next').NextConfig} */
export default {
  // Chromium and Playwright stay as runtime node_modules, not bundled.
  serverExternalPackages: ['@sparticuz/chromium', 'playwright-core'],
  // Template HTML, assets, fonts and the fit engine are read from disk at runtime.
  outputFileTracingIncludes: {
    '/api/render': ['./templates/**/*', './fonts/**/*', './scripts/fit.js', './node_modules/@sparticuz/chromium/bin/**', './node_modules/playwright-core/**'],
  },
  outputFileTracingExcludes: {
    '/api/render': ['./templates/*/reference/**', './templates/*/source/**'],
  },
};
