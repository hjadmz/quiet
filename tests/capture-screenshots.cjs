'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

// Shot as a published site, not a preview: the footer's config notice is gated on
// JEKYLL_ENV, so a non-production build put "1 setting in your config could not be
// used as written" in the README's own hero image — a diagnostic, in the product
// shot, on a template people judge in five seconds. The viewport is a window someone
// actually has; the footer is pinned to the bottom of it, so an over-tall one shows
// mostly the gap above the footer rather than the site.
const ROOT = path.resolve(__dirname, '..');
const htmlPath = path.join(ROOT, '_site/index.html');
const cssPath = path.join(ROOT, '_site/assets/css/main.css');

async function capture(browser, theme) {
  const page = await browser.newPage({
    colorScheme: theme,
    deviceScaleFactor: 1,
    viewport: { width: 1568, height: 900 }
  });
  const css = fs.readFileSync(cssPath, 'utf8');
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html.replace('<html lang="en">', `<html lang="en" data-theme="${theme}">`);
  html = html.replace(/<link rel="stylesheet"[^>]+>/, `<style>${css}</style>`);
  html = html.replace(/<link rel="(?:icon|alternate icon|apple-touch-icon)"[^>]*>\n?/g, '');
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: path.join(ROOT, `docs/screenshot-${theme}.png`),
    animations: 'disabled'
  });
  await page.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await capture(browser, 'light');
    await capture(browser, 'dark');
    process.stdout.write('PASS README screenshots: light and dark at 1568×900\n');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
