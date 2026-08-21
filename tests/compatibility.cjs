'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { AxeBuilder } = require('@axe-core/playwright');
const { chromium, firefox, webkit } = require('playwright');

const ROOT = path.resolve(process.env.SITE_ROOT || path.join(__dirname, '..', '_site-test'));
const HOST = '127.0.0.1';
const ENGINES = { chromium, firefox, webkit };
const REQUESTED = (process.env.COMPAT_BROWSER || 'chromium,firefox,webkit')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);
const ROUTES = [
  '/',
  '/about/',
  '/archive/',
  '/2026/everything-a-post-can-do/',
  '/404.html'
];
const VIEWPORTS = [
  { width: 280, height: 653 },
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 2560, height: 1352 }
];

function contentType(file) {
  return ({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.xml': 'application/xml; charset=utf-8'
  })[path.extname(file)] || 'application/octet-stream';
}

function startServer() {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, `http://${HOST}`).pathname);
    let relative = pathname.replace(/^\/+/, '');
    if (!relative || pathname.endsWith('/')) relative = path.join(relative, 'index.html');
    let file = path.resolve(ROOT, relative);
    let status = 200;

    if (file !== ROOT && !file.startsWith(`${ROOT}${path.sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      file = path.join(ROOT, '404.html');
      status = 404;
    }
    const body = fs.readFileSync(file);
    response.writeHead(status, {
      'content-type': contentType(file),
      'x-content-type-options': 'nosniff'
    });
    response.end(body);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, HOST, () => {
      const { port } = server.address();
      resolve({ server, baseURL: `http://${HOST}:${port}` });
    });
  });
}

function monitor(page, baseURL) {
  const failures = [];
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== baseURL) failures.push(`external request: ${request.url()}`);
  });
  return failures;
}

async function goto(page, baseURL, route, expectedStatus = 200) {
  const response = await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
  assert.equal(response.status(), expectedStatus, `${route}: unexpected HTTP status`);
}

async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth
  }));
  assert.ok(dimensions.scroll <= dimensions.client + 1,
    `${label}: horizontal overflow (${dimensions.scroll}px > ${dimensions.client}px)`);
}

async function controlRects(page, selector) {
  return page.locator(selector).evaluateAll((elements) => elements
    .filter((element) => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    })
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return { text: element.textContent.trim(), x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }));
}

function assertTargets(rects, label) {
  for (const rect of rects) {
    assert.ok(rect.height >= 43.5, `${label}: ${rect.text} target is only ${rect.height}px tall`);
  }
  for (let first = 0; first < rects.length; first += 1) {
    for (let second = first + 1; second < rects.length; second += 1) {
      const a = rects[first];
      const b = rects[second];
      const overlaps = a.x < b.x + b.width && a.x + a.width > b.x &&
        a.y < b.y + b.height && a.y + a.height > b.y;
      assert.equal(overlaps, false, `${label}: ${a.text} overlaps ${b.text}`);
    }
  }
}

async function focusSkipLink(page, engineName) {
  // macOS WebKit follows Safari's system setting and may require Option+Tab
  // to include links. Chromium/Firefox retain the literal first-Tab check;
  // WebKit verifies the same focus/activation path without assuming that OS setting.
  if (engineName === 'webkit') await page.locator('.skip-link').focus();
  else await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('skip-link')), true,
    `${engineName}: skip link must be keyboard-focusable`);
}

async function runResponsive(engineName, browser, baseURL) {
  const context = await browser.newContext({ colorScheme: 'dark', reducedMotion: 'reduce' });
  const page = await context.newPage();
  const failures = monitor(page, baseURL);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await goto(page, baseURL, '/');
    await assertNoOverflow(page, `${engineName} home ${viewport.width}px`);
    assertTargets(await controlRects(page, '.site-header a'), `${engineName} header ${viewport.width}px`);
    assertTargets(await controlRects(page, '.footer-links a, .footer-links button'),
      `${engineName} footer ${viewport.width}px`);

    await page.locator('.wordmark').evaluate((element) => {
      element.textContent = 'hjadmzdesignengineeringwithoutbreaks';
    });
    await page.locator('.tagline').evaluate((element) => {
      element.textContent = 'alongunbrokentaglinethatmustremaininsideeverynarrowviewport';
    });
    await page.locator('.footer-meta').last().evaluate((element) => {
      element.textContent = 'averylongunbrokenfooteridentitythatstillneedstowrap';
    });
    await assertNoOverflow(page, `${engineName} customized home ${viewport.width}px`);

    await goto(page, baseURL, '/2026/everything-a-post-can-do/');
    await assertNoOverflow(page, `${engineName} reference post ${viewport.width}px`);
    await page.locator('.post-header h1').evaluate((element) => {
      element.textContent = 'averylongunbrokenposttitlethatmustneverwidendocumentlayout';
    });
    await assertNoOverflow(page, `${engineName} customized post ${viewport.width}px`);

    const prose = await page.locator('.post-content').evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        width: element.getBoundingClientRect().width,
        fontSize: Number.parseFloat(style.fontSize),
        lineHeight: Number.parseFloat(style.lineHeight)
      };
    });
    assert.ok(prose.width <= 628, `${engineName} ${viewport.width}px: prose measure is ${prose.width}px`);
    assert.ok(prose.fontSize >= 17 && prose.fontSize <= 19.1,
      `${engineName} ${viewport.width}px: body font is ${prose.fontSize}px`);
    assert.ok(prose.lineHeight / prose.fontSize >= 1.59 && prose.lineHeight / prose.fontSize <= 1.61,
      `${engineName} ${viewport.width}px: line-height ratio drifted`);
  }

  assert.deepEqual(failures, [], `${engineName}: browser errors or third-party requests`);
  await context.close();
}

async function runInteraction(engineName, browser, baseURL) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('quiet-test-seeded')) {
      localStorage.setItem('theme', 'invalid-value');
      sessionStorage.setItem('quiet-test-seeded', 'true');
    }
  });
  if (engineName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
  } else {
    await context.addInitScript(() => {
      let copied = '';
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText(value) { copied = value; return Promise.resolve(); },
          readText() { return Promise.resolve(copied); }
        }
      });
    });
  }
  const page = await context.newPage();
  const failures = monitor(page, baseURL);
  await goto(page, baseURL, '/2026/everything-a-post-can-do/');

  assert.equal(await page.locator('#theme-label').textContent(), 'system',
    `${engineName}: invalid stored theme must fall back to system`);
  assert.equal(await page.locator('html').getAttribute('data-theme'), null);
  assert.equal(await page.locator('.site-header #theme-toggle').count(), 0,
    `${engineName}: theme control must not compete with reading navigation`);
  await page.locator('#theme-toggle').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.locator('#theme-toggle').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark',
    `${engineName}: theme choice must persist`);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('body').press('Home');
  await focusSkipLink(page, engineName);
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'main',
    `${engineName}: skip link must move focus to main`);
  await page.keyboard.press('Tab');
  if (engineName === 'webkit') {
    assert.equal(await page.evaluate(() => document.activeElement?.closest('.site-header') !== null), false,
      `${engineName}: next keyboard stop after skip must bypass repeated navigation`);
  } else {
    assert.equal(await page.evaluate(() => document.activeElement?.closest('.toc') !== null), true,
      `${engineName}: next Tab after skip must enter the content`);
  }

  const copy = page.locator('.copy-btn').first();
  await copy.click();
  await page.waitForFunction((button) => button.textContent !== 'copy', await copy.elementHandle());
  assert.equal(await copy.textContent(), 'copied', `${engineName}: copy control must confirm success`);
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /function readingTime/,
    `${engineName}: copy control must write the code`);

  assert.equal(await page.locator('.table-wrap[role="region"][aria-label="scrollable table"][tabindex="0"] table.wide').count(), 1,
    `${engineName}: attributed tables need a labelled keyboard-scroll region`);
  assert.equal(await page.locator('h3#deep-links.reference-heading > a.anchor[href="#deep-links"]').count(), 1,
    `${engineName}: attributed headings need a working permalink`);
  assert.equal(await page.locator('.toc a[href="#sentinel-heading"]').textContent(),
    'Lists ||| stay @@@ readable',
    `${engineName}: TOC text must not depend on delimiter sentinels`);
  const image = await page.locator('figure img').evaluate((element) => ({
    width: element.getAttribute('width'),
    height: element.getAttribute('height'),
    naturalWidth: element.naturalWidth,
    naturalHeight: element.naturalHeight
  }));
  assert.deepEqual(image, { width: '1200', height: '675', naturalWidth: 1200, naturalHeight: 675 },
    `${engineName}: images need stable intrinsic dimensions`);

  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('.site-header').isVisible(), false, `${engineName}: print must hide header`);
  assert.equal(await page.locator('.site-footer').isVisible(), false, `${engineName}: print must hide footer`);
  await page.emulateMedia({ media: 'screen' });

  assert.deepEqual(failures, [], `${engineName}: browser errors or third-party requests`);
  await context.close();
}

async function runNoJavaScript(engineName, browser, baseURL) {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 280, height: 653 }
  });
  const page = await context.newPage();
  const failures = monitor(page, baseURL);
  await goto(page, baseURL, '/2026/everything-a-post-can-do/');
  await assertNoOverflow(page, `${engineName} no-JS`);
  assert.equal(await page.locator('#theme-toggle').isVisible(), false);
  assert.equal(await page.locator('.copy-btn').count(), 0);
  assert.equal(await page.locator('.toc a').count(), 7);
  assert.equal(await page.locator('a.anchor').count(), 8);
  await focusSkipLink(page, engineName);
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'main',
    `${engineName}: native skip link must work without JavaScript`);
  assert.deepEqual(failures, [], `${engineName} no-JS: browser errors or third-party requests`);
  await context.close();
}

async function runAccessibility(engineName, browser, baseURL) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const failures = monitor(page, baseURL);
  for (const route of ROUTES) {
    await goto(page, baseURL, route);
    const results = await new AxeBuilder({ page }).analyze();
    assert.deepEqual(results.violations, [],
      `${engineName} ${route}: axe violations\n${JSON.stringify(results.violations, null, 2)}`);
  }
  assert.deepEqual(failures, [], `${engineName} accessibility: browser errors or third-party requests`);
  await goto(page, baseURL, '/definitely-missing', 404);
  assert.match(await page.locator('h1').textContent(), /nothing here/i);
  await context.close();
}

async function runReducedMotion(engineName, browser, baseURL) {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  await goto(page, baseURL, '/');
  const styles = await page.locator('.wordmark').evaluate((element) => {
    const style = getComputedStyle(element);
    return { transition: style.transitionDuration, animation: style.animationDuration };
  });
  assert.match(styles.transition, /^(?:0s(?:, 0s)*)$/, `${engineName}: reduced-motion transition remains`);
  assert.match(styles.animation, /^(?:0s(?:, 0s)*)$/, `${engineName}: reduced-motion animation remains`);
  await context.close();
}

(async () => {
  for (const name of REQUESTED) assert.ok(ENGINES[name], `unknown browser engine: ${name}`);
  const { server, baseURL } = await startServer();
  try {
    for (const name of REQUESTED) {
      const browser = await ENGINES[name].launch();
      try {
        await runResponsive(name, browser, baseURL);
        await runInteraction(name, browser, baseURL);
        await runNoJavaScript(name, browser, baseURL);
        await runAccessibility(name, browser, baseURL);
        await runReducedMotion(name, browser, baseURL);
        process.stdout.write(`PASS ${name}\n`);
      } finally {
        await browser.close();
      }
    }
  } finally {
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
