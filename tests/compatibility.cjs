'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { AxeBuilder } = require('@axe-core/playwright');
const { chromium, firefox, webkit } = require('playwright');
const { expect } = require('playwright/test');

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
// Simulated viewport sizes, named after representative devices, from a folded
// foldable through a 5120px ultrawide. Every route is checked at every size in
// all three engines. This does not exercise physical devices, hinges, posture
// changes, or the named devices' browser implementations.
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
    // The root element's own border box, not clientWidth. `scrollbar-gutter: stable`
    // reserves the scrollbar's width on pages that do not scroll, and clientWidth
    // counts that reserved strip as usable: measured on the home page at 1280px, a
    // 1272px element inside a 1265px layout left scrollWidth (1272) under clientWidth
    // (1280), so seven real pixels of overflow read as clean. The border box is the
    // width the layout actually got.
    layout: document.documentElement.getBoundingClientRect().width,
    scroll: document.documentElement.scrollWidth
  }));
  assert.ok(dimensions.scroll <= dimensions.layout + 1,
    `${label}: horizontal overflow (${dimensions.scroll}px > ${dimensions.layout}px)`);
}

// The page is one column, and everything on it says so.
//
// Alignment is the part of this template a reader never notices working and always
// notices failing, and it is what drifts first when someone adds a rule. Everything
// this catches was real and none of it broke any other check, because the site was
// still perfectly whole each time: a wide figure's caption sat 180px outside the
// reading column (capping its width had been mistaken for placing it); the two links
// on the page's own edges sat 2px off it, because the padding that buys their hit
// area also moved their text; and in a right-to-left document the wide figure landed
// 325px off and put 296px of horizontal scroll on the whole page.
//
// Two separate promises are checked here. ANCHORED names the handful of elements
// that must sit exactly on an edge of the column — no tolerance, because there is no
// reason for any of them to be a pixel off. The sweep is the general case: prose may
// step off the column by a small declared indent (a list marker, a quote rule) and
// there must be few such steps, or it stops reading as one column. Items inside a
// horizontal row are skipped by the sweep and covered by ANCHORED instead — the
// middle of a right-aligned cluster has no rail to be on.
const ANCHORED = [
  ['.wordmark', 'start', true],
  ['.footer-links > a:first-child', 'start', true],
  ['.site-footer > .footer-meta:last-of-type', 'start', true],
  ['.post-nav-older', 'end', false],
  ['.post-nav-newer', 'start', false]
];

async function assertTextRails(page, label) {
  const measured = await page.evaluate((anchored) => {
    const main = document.querySelector('main');
    if (!main) return null;
    const rtl = getComputedStyle(main).direction === 'rtl';
    // The content edges: what a reader actually sees a line of text begin and end at,
    // which is not the border box when something is padded.
    const edges = (el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const left = r.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
      const right = r.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
      return rtl ? { start: right, end: left } : { start: left, end: right };
    };
    const column = edges(main);
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const BLOCK = /^(block|flow-root|list-item|flex|grid|table|table-cell)/;
    const name = (el) => el.tagName.toLowerCase() +
      (typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\s+/)[0] : '');
    const from = (el, side) => {
      const own = edges(el);
      const gap = side === 'start'
        ? (rtl ? column.start - own.start : own.start - column.start)
        : (rtl ? own.end - column.end : column.end - own.end);
      return Math.round(gap * 100) / 100;
    };

    const missing = [];
    const offEdge = [];
    for (const [selector, side, required] of anchored) {
      const el = document.querySelector(selector);
      if (!el) { if (required) missing.push(selector); continue; }
      const gap = from(el, side);
      if (Math.abs(gap) > 0.5) offEdge.push(`${selector} is ${gap}px off the column ${side}`);
    }

    // The header row is the one place the rail depends on the width. While the links
    // share a line with the wordmark they finish on the column's far edge; once a long
    // enough title pushes them onto a line of their own they begin on its near edge
    // instead. Both are rails — measured on a folded foldable at 280px, where the
    // title alone fills the line — so the check has to ask which state it is in rather
    // than assume one and be wrong on small screens.
    const wordmark = document.querySelector('.wordmark');
    const cluster = document.querySelector('.site-links');
    if (wordmark && cluster) {
      const wrapped = Math.abs(cluster.getBoundingClientRect().top -
        wordmark.getBoundingClientRect().top) > 1;
      const edge = wrapped ? cluster.querySelector('a') || cluster : cluster;
      const side = wrapped ? 'start' : 'end';
      if (cluster.getBoundingClientRect().width) {
        const gap = from(edge, side);
        if (Math.abs(gap) > 0.5) {
          offEdge.push(`.site-links (${wrapped ? 'wrapped onto its own line' : 'inline with the wordmark'}) is ${gap}px off the column ${side}`);
        }
      }
    }

    const indents = {};
    const strays = [];
    for (const el of document.querySelectorAll('header *, main *, footer *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      // Absolutely positioned chrome — the copy button — is placed against its own
      // box, not against the text grid, and is inset from it on purpose.
      if (cs.position === 'absolute' || cs.position === 'fixed') continue;
      if (!BLOCK.test(cs.display)) continue;
      if (el.closest('.visually-hidden, .skip-link, .toc-enhanced')) continue;
      // A table's later columns land where its content puts them. Only the first
      // cell in a row is on the text grid, and it is flush with it on purpose.
      if (/^(td|th)$/i.test(el.tagName) && el.previousElementSibling) continue;
      // A horizontal row is a cluster, not a rail. ANCHORED covers its outer edges.
      const parent = el.parentElement;
      if (parent && getComputedStyle(parent).display.includes('flex')) continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      if (el.getBoundingClientRect().width === 0) continue;

      const indent = from(el, 'start');
      if (indent >= -0.6 && indent <= 2 * rem) {
        const key = Math.round(indent);
        indents[key] = (indents[key] || 0) + 1;
        continue;
      }
      // Off the near edge is allowed only for something aligned to the far one.
      if (Math.abs(from(el, 'end')) < 0.6) continue;
      strays.push(`${name(el)} starts ${Math.round(indent)}px from the column`);
    }

    // A caption is prose about the thing above it. A figure may leave the measure;
    // the prose under it may not start somewhere else, in either direction.
    const captions = [...document.querySelectorAll('figcaption')]
      .filter((el) => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0)
      .map((el) => ({
        name: name(el.parentElement),
        off: from(el, 'start'),
        over: Math.round(Math.abs(edges(el).end - edges(el).start) -
          Math.abs(column.end - column.start))
      }));

    return {
      rem,
      missing,
      offEdge,
      strays,
      captions,
      start: column.start,
      indents: Object.keys(indents).map(Number).sort((a, b) => a - b)
    };
  }, ANCHORED);
  if (measured === null) return null;

  assert.deepEqual(measured.missing, [],
    `${label}: an element the layout is anchored on is not on the page. Either it was ` +
    'renamed and ANCHORED needs updating, or it stopped rendering.');

  assert.deepEqual(measured.offEdge, [],
    `${label}: the page has more than one left margin. These sit on the edge of the ` +
    'reading column, and a fraction of a pixel off is still off.');

  assert.deepEqual(measured.strays, [],
    `${label}: text starting off the reading column. Every block belongs either on the ` +
    'column, within a small declared indent of it, or flush to its far edge.');

  assert.ok(measured.indents.length <= 4,
    `${label}: ${measured.indents.length} different text indents (${measured.indents.join('px, ')}px). ` +
    'Measured across every device and both directions, this page uses four: the column ' +
    'itself, a callout rule, a quote rule, and a list marker. A fifth means something ' +
    'stepped off the column without deciding to.');

  for (const caption of measured.captions) {
    assert.ok(Math.abs(caption.off) < 0.6,
      `${label}: the caption under ${caption.name} starts ${caption.off}px off the reading ` +
      'column. A figure may be wider than the measure; the prose under it may not begin ' +
      'somewhere else.');
    assert.ok(caption.over <= 1,
      `${label}: the caption under ${caption.name} is ${caption.over}px wider than the column.`);
  }
  return measured;
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

async function assertKeyboardPermalink(page, label, engineName = label) {
  assert.equal(await page.getByRole('heading', { name: 'Headings get anchors', exact: true }).count(), 1,
    `${label}: the heading's accessible name must contain only its content`);
  const permalink = page.getByRole('link', { name: 'Headings get anchors', exact: true });
  assert.equal(await permalink.count(), 1, `${label}: the permalink must be a named accessible link`);
  assert.equal(await page.locator('h3#deep-links.reference-heading + a.anchor[href="#deep-links"]').count(), 1,
    `${label}: attributed headings and their adjacent permalinks must survive`);
  await page.locator('.post-content p a[href="#text"]').focus();
  await page.keyboard.press(engineName === 'webkit' ? 'Alt+Tab' : 'Tab');
  assert.equal(await permalink.evaluate((el) => el === document.activeElement), true,
    `${label}: sequential keyboard navigation must reach the permalink`);
  // Poll from the driver: requestAnimationFrame polling does not run when the
  // context has JavaScript disabled, even though CSS focus transitions still do.
  const visibleBy = Date.now() + 2000;
  while (await permalink.evaluate((el) => getComputedStyle(el).opacity) !== '1' && Date.now() < visibleBy) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.equal(await permalink.evaluate((el) => getComputedStyle(el).opacity), '1',
    `${label}: the focused permalink must be visible`);
  await page.keyboard.press('Enter');
  assert.equal(new URL(page.url()).hash, '#deep-links', `${label}: Enter must activate the section URL`);
}

async function assertThemeControl(page, state, label) {
  const control = page.getByRole('group', { name: 'Theme', exact: true });
  assert.equal(await control.isVisible(), true, `${label}: theme control must be visible`);
  assert.deepEqual(await control.locator('label').allInnerTexts(), ['System', 'Light', 'Dark'],
    `${label}: all three choices must be named on screen`);
  assert.equal(await control.getByRole('radio', { name: new RegExp(`^${state}$`, 'i'), checked: true }).count(), 1,
    `${label}: the selected theme must be exposed to assistive technology`);
  assert.equal(await page.locator('html').getAttribute('data-theme'), state === 'system' ? null : state,
    `${label}: the rendered theme and the preference label must agree`);
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
    const columnStarts = new Map();
    for (const route of ROUTES) {
      await goto(page, baseURL, route, route === '/404.html' ? 200 : 200);
      await assertNoOverflow(page, `${label} ${route}`);
      const rails = await assertTextRails(page, `${label} ${route}`);
      if (rails) columnStarts.set(route, rails.start);
      assertTargets(await controlRects(page, '.site-header a, #theme-control label'), `${label} ${route} header`);
      assertTargets(await controlRects(page, '.footer-links a'), `${label} ${route} footer`);

      await assertThemeControl(page, 'system', `${label} ${route}`);

      // A contents list with no entries is worse than none: it takes the space
      // and answers nothing.
      assert.equal(await page.evaluate(() => {
        const toc = document.querySelector('.toc');
        return toc ? toc.querySelectorAll('a').length > 0 : true;
      }), true, `${label} ${route}: the contents list rendered with no entries`);
      checks += 1;
    }

    // The column must not move sideways between routes. A short page does not scroll
    // and a long one does, so without a reserved scrollbar gutter the whole layout —
    // wordmark, text, footer — shifts by half the scrollbar on every navigation.
    // Measured at 1280px before the fix: 298px on the home page against 290.5px on a
    // post, with the cross-fade putting the jump directly under the reader's eye. A
    // browser without scrollbar-gutter support fails here, which is the honest
    // outcome — its readers really do see it.
    const placements = [...new Set([...columnStarts.values()].map((x) => x.toFixed(1)))];
    assert.equal(placements.length, 1,
      `${label}: the reading column sits at ${placements.join('px / ')}px depending on the ` +
      'route. A page that scrolls must not shift the layout against one that does not.');

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
      localStorage.setItem('quiet-theme', 'invalid-value');
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
  await page.clock.install();
  const failures = monitor(page, baseURL);
  await goto(page, baseURL, '/2026/everything-a-post-can-do/');

  assert.equal(await page.evaluate(() => localStorage.getItem('quiet-theme')), 'invalid-value',
    `${engineName}: the invalid preference test must seed the application's storage key`);
  const theme = page.locator('.site-header #theme-control');
  await assertThemeControl(page, 'system', engineName);
  await theme.locator('label[for="theme-light"]').click();
  await assertThemeControl(page, 'light', engineName);
  await theme.locator('label[for="theme-dark"]').click();
  await assertThemeControl(page, 'dark', engineName);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark',
    `${engineName}: theme choice must persist`);
  await assertThemeControl(page, 'dark', `${engineName} after reload`);

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

  // Control time in the real page so the first button resets just after a second
  // copy, without relying on machine speed or a synthetic implementation of the DOM.
  await page.clock.pauseAt(await page.evaluate(() => Date.now()) + 1000);
  const copy = page.locator('.copy-btn').first();
  const secondCopy = page.locator('.copy-btn').nth(1);
  const live = page.locator('body > [aria-live="polite"]');
  assert.equal(await live.count(), 1, `${engineName}: copy confirmations need one shared live region`);
  const firstLanguage = (await copy.getAttribute('aria-label')).replace(/^copy /, '');
  const secondLanguage = (await secondCopy.getAttribute('aria-label')).replace(/^copy /, '');
  await copy.click();
  await expect(copy).toHaveText('copied');
  await expect(copy).toHaveAccessibleName(`copied ${firstLanguage}`);
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /function readingTime/,
    `${engineName}: copy control must write the code`);
  await page.clock.runFor(1900);
  await secondCopy.click();
  await expect(secondCopy).toHaveText('copied');
  await expect(secondCopy).toHaveAccessibleName(`copied ${secondLanguage}`);
  await page.clock.runFor(100);
  await expect(copy).toHaveText('copy');
  await expect(copy).toHaveAccessibleName(`copy ${firstLanguage}`);
  await expect(secondCopy).toHaveText('copied');
  await expect(live).toHaveText('copied');
  await page.clock.runFor(1900);
  await expect(secondCopy).toHaveText('copy');
  await expect(secondCopy).toHaveAccessibleName(`copy ${secondLanguage}`);
  await expect(live).toBeEmpty();

  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: () => Promise.reject(new Error('Clipboard denied by test')) }
  }));
  await copy.click();
  await expect(copy).toHaveText('copy failed');
  await expect(copy).toHaveAccessibleName(`copy failed ${firstLanguage}`);
  await expect(live).toHaveText('copy failed');
  const copyHelp = page.locator('.copy-help').first();
  await expect(copyHelp).toBeVisible();
  await expect(copyHelp).toContainText('Select the code');
  await page.clock.runFor(2000);
  await expect(copy).toHaveText('copy');
  await expect(copy).toHaveAccessibleName(`copy ${firstLanguage}`);
  await expect(live).toBeEmpty();
  await expect(copyHelp).toBeVisible();
  // A successful retry clears the persistent recovery guidance.
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { writeText: () => Promise.resolve() }
  }));
  await copy.click();
  await expect(copy).toHaveText('copied');
  await expect(copyHelp).toBeHidden();
  await page.clock.resume();

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
  await assertKeyboardPermalink(page, engineName);
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
  // This page is still in forced dark mode. Printing must reset syntax colors
  // too: the dark palette had only about 2:1 contrast on the white print canvas.
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  const printContrast = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    return ['.highlight .kd', '.highlight .sr', '.highlight .mi'].map((selector) => {
      const token = document.querySelector(selector);
      if (!token) return { selector, missing: true };
      ctx.fillStyle = getComputedStyle(token).color;
      ctx.fillRect(0, 0, 1, 1);
      const linear = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map((v) => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
      return { selector, contrast: 1.05 / (luminance + 0.05) };
    });
  });
  for (const token of printContrast) {
    assert.ok(!token.missing && token.contrast >= 4.5,
      `${engineName}: ${token.selector} print contrast is ${token.contrast ?? 'unmeasured'}:1`);
  }
  await page.emulateMedia({ media: 'screen' });

  // Native radios use arrow keys. A direct System choice replaces the saved override.
  await theme.getByRole('radio', { name: 'Dark', exact: true }).focus();
  await page.keyboard.press('ArrowLeft');
  await assertThemeControl(page, 'light', `${engineName} keyboard`);
  await theme.locator('label[for="theme-system"]').click();
  await assertThemeControl(page, 'system', engineName);
  assert.equal(await page.evaluate(() => localStorage.getItem('quiet-theme')), 'system',
    `${engineName}: returning to system must replace the stored override`);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Blocked storage', 'SecurityError'); };
  });
  await theme.locator('label[for="theme-dark"]').click();
  await assertThemeControl(page, 'dark', `${engineName} with blocked storage`);

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
  assert.equal(await page.locator('#theme-control').isVisible(), false);
  assert.equal(await page.locator('.copy-btn').count(), 0);
  assert.equal(await page.locator('.toc-toggle').isVisible(), false);
  assert.equal(await page.locator('.toc li a').first().isVisible(), true);
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
  await assertKeyboardPermalink(page, `${engineName} no-JS`, engineName);
  assert.deepEqual(failures, [], `${engineName} no-JS: browser errors or third-party requests`);
  await context.close();
}

async function runReadingNavigation(engineName, browser, baseURL) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await goto(page, baseURL, '/2026/everything-a-post-can-do/');
    const trigger = page.locator('.toc-toggle');
    const ring = page.locator('.toc-ring-fill');
    await expect(trigger).toContainText('Introduction');
    await expect(ring).toHaveAttribute('stroke-dasharray', '0 100');
    await trigger.focus();
    await page.keyboard.press('Enter');
    const list = page.locator('#quiet-toc-list');
    await expect(list).toBeVisible();
    const destination = list.locator('a').nth(2);
    const title = (await destination.textContent()).trim();
    const hash = await destination.getAttribute('href');
    await destination.focus();
    await page.keyboard.press('Enter');
    await expect(list).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`${hash}$`));
    await expect(page.locator(hash)).toBeFocused();
    await expect(trigger).toContainText(title);
    await expect(destination).toHaveAttribute('aria-current', 'location');
    await page.goBack();
    assert.equal(new URL(page.url()).hash, '');
    await expect(trigger).toContainText('Introduction');

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(ring).toHaveAttribute('stroke-dasharray', '100 100');
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(trigger).toContainText('Introduction');
    await expect(ring).toHaveAttribute('stroke-dasharray', '0 100');
    await trigger.click();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(list).toBeHidden();

    await page.setViewportSize({ width: 390, height: 260 });
    await expect(trigger).toBeHidden();
    await expect(list).toBeVisible();
    await page.setViewportSize({ width: 1920, height: 1000 });
    await expect(trigger).toBeVisible();
    const articleBox = await page.locator('article.post').boundingBox();
    const triggerBox = await trigger.boundingBox();
    assert.ok(triggerBox.x > articleBox.x + articleBox.width,
      `${engineName}: the desktop control overlaps the reading column`);

    // The ring reaches 100% as soon as the end is visible. Keep following the
    // heading at the reading line until the document actually stops scrolling.
    await page.evaluate(() => {
      const { bottom } = document.querySelector('article.post').getBoundingClientRect();
      window.scrollTo(0, Math.ceil(window.scrollY + bottom - innerHeight) + 2);
    });
    await expect(ring).toHaveAttribute('stroke-dasharray', '100 100');
    await expect(trigger).toContainText('Embedded media');
    const maxScroll = await page.evaluate(() => {
      const scroller = document.scrollingElement;
      window.scrollTo(0, scroller.scrollHeight);
      return scroller.scrollHeight - scroller.clientHeight;
    });
    await expect(trigger).toContainText('A quote');

    // Both late targets clamp to the same scroll offset at this viewport size.
    // A keyboard jump must still select the right link and move focus there.
    for (const title of ['A running demo', 'A quote']) {
      await trigger.focus();
      await page.keyboard.press('Enter');
      const link = list.getByRole('link', { name: title, exact: true, includeHidden: true });
      const hash = await link.getAttribute('href');
      await link.focus();
      await page.keyboard.press('Enter');
      await expect(list).toBeHidden();
      await expect(page).toHaveURL(new RegExp(`${hash}$`));
      await expect(page.locator(hash)).toBeFocused();
      await expect(trigger).toContainText(title);
      await expect(link).toHaveAttribute('aria-current', 'location');
      assert.ok(Math.abs(await page.evaluate(() => window.scrollY) - maxScroll) <= 1,
        `${engineName}: late heading jump should be clamped to the document end`);
    }
    await page.goBack();
    await expect(trigger).toContainText('A running demo');
    await page.evaluate(() => window.scrollBy(0, -30));
    await expect(trigger).toContainText('Embedded media');
    await page.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight));
    await expect(trigger).toContainText('A quote');
  } finally {
    await context.close();
  }
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
  if (engineName === 'chromium') {
    await page.emulateMedia({ forcedColors: 'active' });
    const theme = page.locator('#theme-control');
    await theme.getByRole('radio', { name: 'System', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await assertThemeControl(page, 'light', `${engineName} forced colors`);
    const outline = await theme.evaluate(control => {
      const selected = getComputedStyle(control.querySelector(':checked + label'));
      const unselected = getComputedStyle(control.querySelector(':not(:checked) + label'));
      return {
        selected: selected.borderTopColor,
        unselected: unselected.borderTopColor,
        fill: getComputedStyle(control).backgroundColor,
        focus: selected.outlineStyle
      };
    });
    assert.equal(outline.unselected, outline.fill, 'unselected segments must have no visible outline');
    assert.notEqual(outline.selected, outline.unselected, 'selected theme must remain distinct');
    assert.equal(outline.focus, 'solid', 'keyboard focus must stay visible in forced colors');
  }
  await context.close();
}

// Test article extraction in Firefox's Readability-based reader view
// (about:reader). This is evidence for that extractor only; Safari Reader,
// Edge Read Aloud, and screen-reader output need separate platform checks.
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
      hashLinks: [...root.querySelectorAll('a')].filter((a) => a.textContent.trim() === '#').length,
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

  // The permalink's decorative hash must not enter the extracted reading text.
  for (const heading of extracted.headings) {
    assert.doesNotMatch(heading, /#\s*$/,
      `${engineName}: heading "${heading}" carries its permalink into reader view, where it is read aloud`);
  }
  assert.equal(extracted.hashLinks, 0,
    `${engineName}: reader view must not move the permalink hash outside its heading and read it there`);

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
        return [...document.querySelectorAll('.site-header a, #theme-control label, .footer-links a')]
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

// Exercise CSS environments that ordinary viewport resizing cannot reproduce.
async function runLayoutEnvironments(engineName, browser, baseURL) {
  const context = await browser.newContext({
    colorScheme: 'dark', viewport: { width: 844, height: 390 }
  });
  try {
    const page = await context.newPage();
    await goto(page, baseURL, '/2026/everything-a-post-can-do/');
    assert.equal(await page.locator('head style').count(), 1,
      `${engineName}: the fixture must exercise a real configured accent`);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.emulateMedia({ media: 'print' });
    const accent = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--accent)';
      document.body.appendChild(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    assert.equal(accent, 'rgb(0, 0, 0)',
      `${engineName}: a configured dark accent must return to black in print`);
    await page.emulateMedia({ media: 'screen' });

    // CDP supplies actual env() values; these are simulated cutouts, not
    // physical-device results. Firefox and WebKit still run the print check.
    if (engineName !== 'chromium') return;
    const cdp = await context.newCDPSession(page);
    for (const [left, right] of [[47, 47], [59, 0], [0, 59]]) {
      await cdp.send('Emulation.setSafeAreaInsetsOverride', {
        insets: { left, right, top: 0, bottom: 0 }
      });
      for (const direction of ['ltr', 'rtl']) {
        await page.evaluate((dir) => document.documentElement.setAttribute('dir', dir), direction);
        const layout = await page.evaluate(() => ({
          left: parseFloat(getComputedStyle(document.body).paddingLeft),
          right: parseFloat(getComputedStyle(document.body).paddingRight),
          viewport: innerWidth,
          media: [...document.querySelectorAll('.post-content > .wide > :not(figcaption)')]
            .map((element) => {
              const box = element.getBoundingClientRect();
              return { left: box.left, right: box.right };
            })
        }));
        assert.equal(layout.left, left, 'the safe-area override must reach body padding');
        assert.equal(layout.right, right, 'the safe-area override must reach body padding');
        assert.ok(layout.media.length > 0, 'the fixture must contain wide media');
        for (const box of layout.media) {
          assert.ok(box.left >= left - 1 && box.right <= layout.viewport - right + 1,
            `${direction}: wide media crosses the ${left}/${right}px display safe area`);
        }
      }
    }
  } finally {
    await context.close();
  }
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
          ['reading-navigation', runReadingNavigation],
          ['no-JavaScript', runNoJavaScript],
          ['accessibility', runAccessibility],
          ['reader-mode', runReaderMode],
          ['text-scaling', runTextScaling],
          ['reduced-motion', runReducedMotion],
          ['layout-environments', runLayoutEnvironments]
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
