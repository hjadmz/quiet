import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Optional authoring tool. Reading the site never requires Node or Playwright.
const root = fileURLToPath(new URL('../', import.meta.url));
const iconPath = path.join(root, 'assets/img/favicon.svg');
const cardPath = path.join(root, 'docs/brand/social-card.svg');

function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16;
    header[entry] = size;
    header[entry + 1] = size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map(({ png }) => png)]);
}

let browser;
try {
  const [icon, card] = await Promise.all([
    fs.readFile(iconPath, 'utf8'), fs.readFile(cardPath, 'utf8')
  ]);
  browser = await chromium.launch();
  const context = await browser.newContext({
    colorScheme: 'light', deviceScaleFactor: 1, javaScriptEnabled: false
  });
  const requests = [];
  await context.route('**/*', route => {
    requests.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  async function render(source, width, height, label) {
    const valid = await page.evaluate(svg => {
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      return !doc.querySelector('parsererror') && doc.documentElement.localName === 'svg'
        && doc.documentElement.namespaceURI === 'http://www.w3.org/2000/svg';
    }, source);
    if (!valid) throw new Error(`${label} must be valid SVG.`);
    await page.setViewportSize({ width, height });
    await page.setContent(`<style>html,body{margin:0}body>svg{display:block;width:100vw;height:100vh}</style>${source}`);
    await page.evaluate(() => document.fonts.ready);
    const png = await page.screenshot({ animations: 'disabled' });
    if (requests.length) throw new Error(`${label} must be self-contained; an external resource was requested.`);
    return png;
  }
  const small = await render(icon, 16, 16, 'favicon.svg');
  const large = await render(icon, 32, 32, 'favicon.svg');
  const touch = await render(icon, 180, 180, 'favicon.svg');
  const social = await render(card, 1200, 630, 'social-card.svg');
  // Render and stage every file before replacing an asset. Each rename is
  // atomic, so a failed write cannot truncate a previously working image.
  const assets = path.join(root, 'assets/img');
  const outputs = [
    ['favicon.ico', ico([{ size: 16, png: small }, { size: 32, png: large }])],
    ['apple-touch-icon.png', touch], ['og-default.png', social]
  ];
  const staging = await fs.mkdtemp(path.join(assets, '.brand-export-'));
  try {
    for (const [name, data] of outputs) await fs.writeFile(path.join(staging, name), data);
    for (const [name] of outputs) await fs.rename(path.join(staging, name), path.join(assets, name));
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
  console.log('Exported favicon.ico (16/32px), apple-touch-icon.png (180px), and og-default.png (1200×630).');
} catch (error) {
  console.error(`Brand export failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
}
