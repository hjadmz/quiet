'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const htmlPath = path.join(ROOT, '_site/index.html');
const cssPath = path.join(ROOT, '_site/assets/css/main.css');

async function capture(browser, theme) {
  const page = await browser.newPage({
    colorScheme: theme,
    deviceScaleFactor: 1,
    viewport: { width: 1568, height: 1120 }
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
    process.stdout.write('PASS README screenshots: light and dark at 1568×1120\n');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
