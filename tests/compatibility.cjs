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
// A demo frame has an opaque origin, so anything inside it that touches storage
// throws — and that refusal is the isolation doing its job. Playwright's own
// injected script reads sessionStorage in every frame it attaches to, so it trips
// this on the demo and the error is reported against the page.
//
// Listed per engine and anchored rather than matched loosely, because WebKit's
// wording is generic enough that a wildcard here would hide real SecurityErrors.
// runInteraction asserts the fixture actually contains a sandboxed demo, so this
// exemption cannot quietly apply to a page that has no reason to need it.
const SANDBOX_DENIALS = [
  /sandboxed and lacks the 'allow-same-origin' flag/,  // Chromium
  /^The operation is insecure\.$/                      // WebKit
];

// Generous, but finite: the whole suite runs in well under a minute per engine
// on a laptop, so anything past this is stuck rather than slow.
const PHASE_TIMEOUT_MS = Number(process.env.COMPAT_PHASE_TIMEOUT_MS || 120000);
// Real devices, named, so nobody has to remember to ask about foldables. The
// list is the promise: a folded Galaxy Z Fold through a 5120px ultrawide, both
// tablet orientations, a phone in landscape, and the laptop sizes people
// actually own. Every route is checked on every one of them, in all three
// engines, on every run — a sweep somebody performs by hand when prompted is not
// a guarantee, it is a memory.
const DEVICES = [
  { name: 'Galaxy Z Fold folded', width: 280, height: 653 },
  { name: 'small phone', width: 320, height: 568 },
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'Pixel 8', width: 412, height: 915 },
  { name: 'Galaxy Z Fold open', width: 717, height: 512 },
  { name: 'iPhone 15 landscape', width: 852, height: 393 },
  { name: 'iPad portrait', width: 768, height: 1024 },
  { name: 'iPad landscape', width: 1024, height: 768 },
  { name: 'MacBook Air 13', width: 1470, height: 956 },
  { name: 'Framework 13', width: 1504, height: 1000 },
  { name: '1080p monitor', width: 1920, height: 1080 },
  { name: '1440p monitor', width: 2560, height: 1440 },
  { name: 'ultrawide 5120', width: 5120, height: 1440 }
];
// The stress pass — injecting unbreakable strings — only needs the extremes and
// one middle, where wrapping actually decides the outcome.
const STRESS = new Set(['Galaxy Z Fold folded', 'Pixel 8', 'iPad portrait', 'ultrawide 5120']);
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
  page.on('pageerror', (error) => {
    if (SANDBOX_DENIALS.some((pattern) => pattern.test(error.message))) return;
    failures.push(`pageerror: ${error.message}`);
  });
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
  let checks = 0;

  for (const device of DEVICES) {
    const label = `${engineName} ${device.name} ${device.width}px`;
    await page.setViewportSize({ width: device.width, height: device.height });

    // Every route, every device. A layout that holds on the home page and breaks
    // on the archive is still a broken site.
    for (const route of ROUTES) {
      await goto(page, baseURL, route, route === '/404.html' ? 200 : 200);
      await assertNoOverflow(page, `${label} ${route}`);
      assertTargets(await controlRects(page, '.site-header a'), `${label} ${route} header`);
      assertTargets(await controlRects(page, '.footer-links a, .footer-links button'),
        `${label} ${route} footer`);

      // Exactly one theme icon is visible, whatever the state — three would mean
      // the state selectors stopped matching and the control started lying.
      assert.equal(await page.evaluate(() =>
        [...document.querySelectorAll('.theme-icon')]
          .filter((icon) => getComputedStyle(icon).display !== 'none').length), 1,
        `${label} ${route}: exactly one theme icon must show`);

      // A contents list with no entries is worse than none: it takes the space
      // and answers nothing.
      assert.equal(await page.evaluate(() => {
        const toc = document.querySelector('.toc');
        return toc ? toc.querySelectorAll('a').length > 0 : true;
      }), true, `${label} ${route}: the contents list rendered with no entries`);
      checks += 1;
    }

    if (!STRESS.has(device.name)) continue;

    await goto(page, baseURL, '/');
    await page.locator('.wordmark').evaluate((element) => {
      element.textContent = 'hjadmzdesignengineeringwithoutbreaks';
    });
    await page.locator('.tagline').evaluate((element) => {
      element.textContent = 'alongunbrokentaglinethatmustremaininsideeverynarrowviewport';
    });
    await page.locator('.footer-meta').last().evaluate((element) => {
      element.textContent = 'averylongunbrokenfooteridentitythatstillneedstowrap';
    });
    await assertNoOverflow(page, `${label} customized home`);

    await goto(page, baseURL, '/2026/everything-a-post-can-do/');
    await page.locator('.post-header h1').evaluate((element) => {
      element.textContent = 'averylongunbrokenposttitlethatmustneverwidendocumentlayout';
    });
    await assertNoOverflow(page, `${label} customized post`);

    const prose = await page.locator('.post-content').evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        width: element.getBoundingClientRect().width,
        fontSize: Number.parseFloat(style.fontSize),
        lineHeight: Number.parseFloat(style.lineHeight)
      };
    });
    // The measure caps rather than stretching: identical on a 1470px laptop and
    // a 5120px ultrawide, which is the whole point of a reading column.
    assert.ok(prose.width <= 628, `${label}: prose measure is ${prose.width}px`);
    assert.ok(prose.fontSize >= 17 && prose.fontSize <= 19.1,
      `${label}: body font is ${prose.fontSize}px`);
    assert.ok(prose.lineHeight / prose.fontSize >= 1.59 && prose.lineHeight / prose.fontSize <= 1.61,
      `${label}: line-height ratio drifted`);
  }

  if (process.env.COMPAT_VERBOSE) {
    process.stdout.write(`  ${engineName}: ${checks} device/route combinations clean\n`);
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

  // The theme control reads as "[icon] system" — the state, not a label plus the
  // state. The word that makes it unambiguous is still in the page, hidden, and
  // it has two jobs: it is the button's accessible name, and find-in-page still
  // matches it. Clip-hidden text is findable in all three engines; display:none
  // text is not, which is why the visually-hidden technique is the one used.
  const themeBtn = page.locator('#theme-toggle');
  assert.equal(await themeBtn.locator('#theme-label').textContent(), 'system',
    `${engineName}: the theme control should show its state, not a label`);
  assert.match((await themeBtn.textContent()).replace(/\s+/g, ' ').trim(), /^theme: /,
    `${engineName}: the accessible name must still say what the control is`);
  assert.equal(await page.evaluate(() => window.find && window.find('theme')), true,
    `${engineName}: find-in-page must still reach the theme control`);
  assert.equal(await page.evaluate(() =>
    [...document.querySelectorAll('.theme-icon')].filter((s) => getComputedStyle(s).display !== 'none').length), 1,
    `${engineName}: exactly one theme icon shows at a time`);

  const shownIcon = () => page.evaluate(() =>
    [...document.querySelectorAll('.theme-icon')]
      .filter((s) => getComputedStyle(s).display !== 'none')
      .map((s) => s.className.baseVal.replace('theme-icon theme-', '')));
  await page.locator('#theme-toggle').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  assert.deepEqual(await shownIcon(), ['light'], `${engineName}: the icon must follow the state`);
  assert.equal(await page.locator('#theme-label').textContent(), 'light');
  await page.locator('#theme-toggle').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  assert.deepEqual(await shownIcon(), ['dark'], `${engineName}: the icon must follow the state`);
  assert.equal(await page.locator('#theme-label').textContent(), 'dark');
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

  // Focusable so an overflowing table can be panned from the keyboard, and
  // deliberately not a landmark: the wrapper label was a constant, so two tables
  // in one post minted two identically-named regions.
  assert.equal(await page.locator('.table-wrap[tabindex="0"] table.wide').count(), 1,
    `${engineName}: attributed tables need a keyboard-scroll container`);
  assert.equal(await page.locator('.table-wrap[role]').count(), 0,
    `${engineName}: the table wrapper must not mint a landmark`);
  assert.equal(await page.locator('pre.highlight[tabindex="0"][role="group"][aria-label="code"]').count() > 0, true,
    `${engineName}: the code scroller must name its tab stop`);

  // The demo frame carries the whole demo inline, so it must make no request of
  // its own and must not be able to reach the page around it.
  //
  // Only the outside is checked in every engine, and that is the isolation
  // working rather than a gap: the frame has an opaque origin, so WebKit's driver
  // cannot enter it at all (measured: frameLocator hangs) and Firefox's reports it
  // as empty. Chromium can, so the one engine that can look inside does.
  const frame = page.locator('.demo-frame');
  assert.equal(await frame.count(), 1,
    `${engineName}: the fixture must contain exactly one sandboxed demo — the ` +
    'SANDBOX_DENIALS exemption is only defensible while it does');
  assert.equal(await frame.getAttribute('sandbox'), 'allow-scripts',
    `${engineName}: a demo must run in an opaque origin, so no allow-same-origin`);
  assert.equal(await frame.getAttribute('src'), null,
    `${engineName}: a demo must be inlined, not fetched`);
  assert.equal(await page.evaluate(() => {
    try {
      return document.querySelector('.demo-frame').contentWindow.document ? 'reachable' : 'null';
    } catch { return 'isolated'; }
  }), 'isolated', `${engineName}: the page must not be able to read into a demo`);
  const frameBox = await frame.boundingBox();
  assert.ok(frameBox && frameBox.width > 0 && frameBox.height > 0,
    `${engineName}: the demo frame must be laid out`);
  if (engineName === 'chromium') {
    assert.equal(await page.frameLocator('.demo-frame').locator('#swatch').count(), 1,
      `${engineName}: the demo must render its initial state`);
  }
  // An accessible name on a descendant is folded into the heading's own name.
  assert.equal(await page.locator('h2#a-table').evaluate((h) => h.textContent.trim()), 'A table#',
    `${engineName}: heading text must not be doubled by the permalink`);
  assert.equal(await page.locator('.anchor[aria-hidden="true"][tabindex="-1"]').count() > 0, true,
    `${engineName}: heading permalinks must stay out of the accessibility tree`);
  assert.equal(await page.locator('h3#deep-links.reference-heading > a.anchor[href="#deep-links"]').count(), 1,
    `${engineName}: attributed headings need a working permalink`);
  assert.equal(await page.locator('.toc a[href="#sentinel-heading"]').textContent(),
    'Lists ||| stay @@@ readable',
    `${engineName}: TOC text must not depend on delimiter sentinels`);
  const image = await page.locator('figure:not(.wide) img').evaluate((element) => ({
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
  // Derived, not counted by hand: the invariant is that the build-time TOC and
  // permalinks cover exactly the headings that have ids, whatever the fixture
  // grows to. A hardcoded number just breaks every time the fixture changes and
  // teaches whoever fixes it to edit the number rather than check the claim.
  const headings = await page.evaluate(() => ({
    tocable: document.querySelectorAll('.post-content h2[id]').length,
    anchorable: document.querySelectorAll('.post-content h2[id], .post-content h3[id], .post-content h4[id]').length
  }));
  assert.ok(headings.tocable > 0, `${engineName} no-JS: fixture has no headings to map`);
  assert.equal(await page.locator('.toc a').count(), headings.tocable,
    `${engineName} no-JS: the table of contents must list every h2 with an id, and only those`);
  assert.equal(await page.locator('a.anchor').count(), headings.anchorable,
    `${engineName} no-JS: every h2-h4 with an id must get a permalink`);
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

// The template refuses to ship its own read-aloud, on the grounds that the reader
// already has a better one. That refusal is only honest if the platform tools
// actually work here, so this checks the claim rather than asserting it.
//
// Firefox is the one engine that exposes its reader view to automation
// (about:reader), and it uses Readability — the same extractor behind Safari
// Reader and most read-aloud tools. What it makes of a post is a good proxy for
// what "Listen to Page" or Edge Read Aloud will speak.
async function runReaderMode(engineName, browser, baseURL) {
  if (engineName !== 'firefox') return;
  const context = await browser.newContext();
  const page = await context.newPage();
  const article = `${baseURL}/2026/everything-a-post-can-do/`;

  // Measure the article as the page itself renders it, so the comparison below is
  // "how much survived extraction" rather than a character count that has to be
  // re-tuned every time the fixture gains a paragraph.
  await page.goto(article, { waitUntil: 'load' });
  const original = await page.evaluate(() => document.querySelector('.post-content').innerText.length);

  await page.goto(`about:reader?url=${encodeURIComponent(article)}`, { waitUntil: 'load' });
  await page.waitForSelector('.moz-reader-content', { timeout: 15000 });
  await page.waitForTimeout(500);

  const extracted = await page.evaluate(() => {
    const root = document.querySelector('.moz-reader-content');
    return {
      title: document.querySelector('.reader-title')?.textContent?.trim() || '',
      headings: [...root.querySelectorAll('h2')].map((h) => h.textContent.trim()),
      text: root.innerText,
      navCount: root.querySelectorAll('nav').length,
      codeBlocks: root.querySelectorAll('pre').length,
      captions: [...root.querySelectorAll('figcaption')].map((f) => f.textContent.trim())
    };
  });

  assert.ok(extracted.title.length > 0,
    `${engineName}: reader view found no title, so read-aloud has nothing to announce`);
  const kept = extracted.text.length / original;
  assert.ok(kept > 0.6,
    `${engineName}: reader view kept only ${Math.round(kept * 100)}% of the article ` +
    `(${extracted.text.length} of ${original} characters); extraction is losing content`);
  assert.ok(extracted.headings.length >= 5,
    `${engineName}: reader view kept ${extracted.headings.length} headings, so section navigation is lost`);

  // The permalink is a pointer affordance. Spoken, "Text number sign" is noise on
  // every heading, so it must not survive into the extracted text.
  for (const heading of extracted.headings) {
    assert.doesNotMatch(heading, /#\s*$/,
      `${engineName}: heading "${heading}" carries its permalink into reader view, where it is read aloud`);
  }

  // The table of contents repeats every heading. Read twice is worse than not at all.
  assert.equal(extracted.navCount, 0,
    `${engineName}: reader view kept a nav, so the contents list is read out before the article`);

  assert.ok(extracted.codeBlocks > 0,
    `${engineName}: reader view dropped the code blocks, so a technical post loses its point`);

  // A demo cannot survive extraction — reader views strip iframes — so its caption
  // is the only thing left to explain what was there. It has to survive.
  assert.ok(extracted.captions.length >= 2 && extracted.text.includes('Drag the slider'),
    `${engineName}: a demo's caption must survive extraction, since the demo itself cannot`);

  await context.close();
}

// Browser text size, which is not page zoom. Zoom scales everything including
// pixel values, so a layout can pass zoom and still break when someone raises
// only their default font size — the setting people with low vision actually
// use, and the one WCAG 1.4.4 is about. It reached 79px of document overflow at
// 48px default text before the header was allowed to wrap.
//
// Chromium only: setting the browser's default font size is a CDP capability
// and Playwright exposes no equivalent for the other two engines. Said plainly
// rather than quietly skipped.
async function runTextScaling(engineName, browser, baseURL) {
  if (engineName !== 'chromium') return;
  for (const standard of [16, 24, 32, 48]) {
    const context = await browser.newContext({ viewport: { width: 320, height: 658 } });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.setFontSizes', { fontSizes: { standard, fixed: Math.round(standard * 0.85) } });

    for (const route of ROUTES) {
      await goto(page, baseURL, route);
      await assertNoOverflow(page, `${engineName} ${route} at ${standard}px default text`);
      assert.equal(await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        return [...document.querySelectorAll('.site-header a, .footer-links a, .footer-links button')]
          .every((el) => el.getBoundingClientRect().right <= width + 1);
      }), true, `${engineName} ${route}: navigation left the viewport at ${standard}px default text`);
    }

    // The copy button is positioned over the code block, and its clearance is
    // expressed in rem so it tracks the text rather than a pixel constant.
    await goto(page, baseURL, '/2026/everything-a-post-can-do/');
    const clearance = await page.evaluate(() => {
      const btn = document.querySelector('.copy-btn');
      const pre = document.querySelector('pre.highlight');
      if (!btn || !pre) return null;
      const top = pre.getBoundingClientRect().top + parseFloat(getComputedStyle(pre).paddingTop);
      return Math.round(top - btn.getBoundingClientRect().bottom);
    });
    if (clearance !== null) {
      assert.ok(clearance >= 0,
        `${engineName}: the copy button covers the first line of code at ${standard}px default text (${clearance}px)`);
    }
    await context.close();
  }
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
        // Named phases with a per-phase deadline. A silent hang in one engine is
        // indistinguishable from a slow machine until the whole job is killed with
        // no idea which check was running; this says which, in every log.
        const PHASES = [
          ['responsive', runResponsive],
          ['interaction', runInteraction],
          ['no-JavaScript', runNoJavaScript],
          ['accessibility', runAccessibility],
          ['reader-mode', runReaderMode],
          ['text-scaling', runTextScaling],
          ['reduced-motion', runReducedMotion]
        ];
        for (const [phase, run] of PHASES) {
          const started = Date.now();
          let timer;
          await Promise.race([
            run(name, browser, baseURL),
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error(`${name}: ${phase} exceeded ${PHASE_TIMEOUT_MS} ms`)), PHASE_TIMEOUT_MS);
            })
          ]).finally(() => clearTimeout(timer));
          if (process.env.COMPAT_VERBOSE) {
            process.stdout.write(`  ${name} ${phase}: ${Date.now() - started} ms\n`);
          }
        }
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
