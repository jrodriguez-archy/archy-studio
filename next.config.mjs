import { readFileSync } from 'node:fs';

// Studio's version: the plugin's, raised with each release (the sidebar shows it).
const version = JSON.parse(readFileSync(new URL('./plugins/archy-studio/.claude-plugin/plugin.json', import.meta.url), 'utf8')).version;

// Template HTML, assets, fonts, the asset library and the fit engine are read from disk at runtime.
const renderFiles = [
  './templates/**/*', './fonts/**/*', './library/**/*', './scripts/fit.js', './scripts/edits.js', './scripts/components.js',
  './brand-kit/**/*', './scripts/explore-check.js',
  './node_modules/@sparticuz/chromium/bin/**', './node_modules/playwright-core/**',
];
// Routes that render with Chromium (Canvas export and save go through /api/canvas).
const rendering = ['/api/render', '/mcp', '/api/preview-render/[template]/[format]', '/api/canvas'];
// Canvas pages prepare the fill (manifests, configs, rules, the library list); images come through /api/template-files.
const canvasPages = ['/canvas/[id]', '/canvas/new', '/canvas', '/api/canvas/live', '/api/template-files/[...path]'];
// Explorations are composed from the brand kit's tokens and logo (its textures come through /api/template-files).
const canvasFiles = ['./templates/**/*', './library/**/*', './scripts/fit.js', './scripts/edits.js', './scripts/components.js', './brand-kit/*/*.{css,svg,md,json}', './brand-kit/*/mascot/*.svg'];
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
  outputFileTracingIncludes: {
    ...Object.fromEntries(rendering.map((r) => [r, renderFiles])),
    '/api/preview/[template]/[format]': ['./templates/*/manifest.json', './scripts/fit.js', './scripts/edits.js'],
    // The Canvas editor reads the asset library list and every template's files (fill plan, editor context).
    ...Object.fromEntries(canvasPages.map((r) => [r, canvasFiles])),
  },
  // Paper references and sources are for designers, never read by the app: no function carries them.
  outputFileTracingExcludes: { '**': notNeeded, ...Object.fromEntries(listing.map((r) => [r, noImages])) },
  experimental: { optimizePackageImports: ['@hugeicons/core-free-icons'] },
  // The deploy's id, so Canvas asks for this deploy's template pages and page scripts (never a cached
  // copy from the one before), and an open Studio knows when a newer deploy is out.
  env: { NEXT_PUBLIC_BUILD: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 10) ?? 'dev', NEXT_PUBLIC_VERSION: version },
  // Template files change only with a deploy. Pages and scripts are asked for with the deploy's id, so a
  // few minutes of browser cache never shows an old one; template images briefly too; fonts for a day.
  async headers() {
    return [
      { source: '/api/template-files/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=600' }] },
      { source: '/api/template-files/fonts/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }] },
    ];
  },
};
