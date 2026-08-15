/**
 * The store-asset harnesses (render-templates / store-assets /
 * store-screenshots) are bundled with esbuild using --external:puppeteer and
 * expect puppeteer to be provided at run time (npx / global install). It is
 * deliberately NOT a package.json dependency — it would add ~300MB of
 * Chromium to every install for scripts that run a few times a year.
 *
 * This shorthand ambient declaration types the module as `any` so
 * `npm run typecheck` stays green and keeps covering those scripts.
 */
declare module 'puppeteer';
