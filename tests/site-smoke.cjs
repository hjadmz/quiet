'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { existsExactCase } = require('./run.cjs');

const ROOT = path.resolve(process.env.SITE_ROOT || path.join(__dirname, '..', '_site'));
const generatedHome = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const canonical = generatedHome.match(/<link rel="canonical" href="([^"]+)"\s*\/?>/);
assert.ok(canonical, 'generated home is missing a canonical URL');
const SITE_URL = new URL(process.env.SITE_URL || canonical[1]);
const BASEURL = (process.env.SITE_BASEURL || '').replace(/\/$/, '');
if (process.env.SITE_URL) {
  const canonicalUrl = new URL(canonical[1]);
  assert.equal(canonicalUrl.origin, SITE_URL.origin,
    `generated home canonical uses ${canonicalUrl.origin}, expected ${SITE_URL.origin}`);
  assert.equal(canonicalUrl.pathname, `${BASEURL}/`,
    `generated home canonical path is ${canonicalUrl.pathname}, expected ${BASEURL}/`);
}
const EXPECT_DEMO = process.env.EXPECT_DEMO
  ? process.env.EXPECT_DEMO !== '0'
  : generatedHome.includes('template demo · sample content');
const EXPECT_CLOUDFLARE = process.env.EXPECT_CLOUDFLARE
  ? process.env.EXPECT_CLOUDFLARE !== '0'
  : fs.existsSync(path.join(ROOT, '_headers'));
const REQUIRED = [
  'index.html',
  'about/index.html',
  'archive/index.html',
  '404.html',
  'feed.xml',
  'sitemap.xml',
  'robots.txt',
  'assets/css/main.css',
  'assets/js/copy.js'
];
if (EXPECT_CLOUDFLARE) REQUIRED.push('_headers');
if (EXPECT_DEMO) {
  REQUIRED.push(
    '2026/hello-world/index.html',
    '2026/everything-a-post-can-do/index.html',
    '2026/in-praise-of-quiet-software/index.html'
  );
}
const FORBIDDEN = [
  'assets/css/style.css',
  'README.md',
  'THIRD_PARTY_NOTICES.md',
  'Gemfile',
  'Gemfile.lock',
  'package.json',
  'package-lock.json',
  'node_modules',
  '.ruby-version',
  'docs',
  'tests',
  'scripts',
  '.jekyll-cache',
  'vendor'
];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

// GitHub Pages serves from a case-sensitive filesystem; macOS and Windows do not. A
// link to /About/ resolves for whoever wrote it and 404s for every reader, and no
// amount of local testing finds it unless the check compares real directory entries.
function isServableFile(file) {
  return isFile(file) && existsExactCase(file, ROOT);
}

function outputPath(fromFile, reference) {
  let pathname;
  try {
    const absolute = new URL(reference);
    if (absolute.origin !== SITE_URL.origin) return null;
    pathname = decodeURIComponent(absolute.pathname);
  } catch {
    pathname = decodeURIComponent(reference.split('#')[0].split('?')[0]);
  }

  if (!pathname) return fromFile;
  let target;
  if (pathname.startsWith('/')) {
    if (BASEURL && pathname !== BASEURL && !pathname.startsWith(`${BASEURL}/`)) {
      throw new Error(`root-relative reference bypasses baseurl: ${reference}`);
    }
    const withoutBase = BASEURL ? pathname.slice(BASEURL.length) : pathname;
    target = path.join(ROOT, withoutBase.replace(/^\/+/, ''));
  } else {
    target = path.resolve(path.dirname(fromFile), pathname);
  }

  if (pathname.endsWith('/')) target = path.join(target, 'index.html');
  if (!path.extname(target) && isFile(path.join(target, 'index.html'))) {
    target = path.join(target, 'index.html');
  }
  return target;
}

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

for (const relative of REQUIRED) {
  assert.ok(isFile(path.join(ROOT, relative)), `missing generated file: ${relative}`);
}
for (const relative of FORBIDDEN) {
  assert.equal(fs.existsSync(path.join(ROOT, relative)), false, `build leaked source/dead file: ${relative}`);
}

const files = walk(ROOT);
const htmlFiles = files.filter((file) => file.endsWith('.html'));
let references = 0;

for (const file of htmlFiles) {
  const relative = path.relative(ROOT, file);
  const html = fs.readFileSync(file, 'utf8');
  const ids = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, `${relative}: duplicate id`);
  assert.equal(count(html, /<h1\b/g), 1, `${relative}: needs exactly one h1`);
  assert.equal(count(html, /<main\b[^>]*\bid=["']main["'][^>]*\btabindex=["']-1["']/g), 1,
    `${relative}: main must be a working skip-link target`);
  assert.match(html, /<html\s+lang=["'][^"']+["']/i, `${relative}: missing document language`);
  assert.match(html, /<meta\s+name="viewport"/i, `${relative}: missing viewport metadata`);
  assert.match(html, /<link rel="stylesheet" href="[^"]*\/assets\/css\/main\.css\?v=\d+">/,
    `${relative}: stylesheet must be build-versioned`);
  assert.match(html, /<link rel="canonical" href="[^"]+"\s*\/?>/, `${relative}: missing canonical URL`);
  // Pages that carry a canonical link but should never be a search result have to
  // say so themselves. A 404 in a result list wastes the one click it gets.
  if (relative === '404.html' || relative.startsWith('site-check')) {
    assert.match(html, /<meta name="robots" content="noindex/,
      `${relative}: has a canonical link and no noindex, so it can be indexed`);
  }
  assert.equal(count(html, /id="theme-toggle"/g), 1, `${relative}: needs one theme control`);
  assert.doesNotMatch(html.match(/<header[\s\S]*?<\/header>/)?.[0] || '', /id="theme-toggle"/,
    `${relative}: theme preference belongs outside the reading path`);
  assert.match(html.match(/<footer[\s\S]*?<\/footer>/)?.[0] || '', /id="theme-toggle"/,
    `${relative}: footer must contain the theme preference`);

  // A configured analytics recipe is a deliberate exception. Markers emitted
  // by the dedicated include keep that exception narrow instead of allowing
  // unrelated third-party runtime dependencies anywhere in the page.
  let runtimeHtml = html;
  if (!EXPECT_DEMO) {
    const head = html.match(/<head\b[^>]*>[\s\S]*?<\/head>/i)?.[0] || '';
    const outsideHead = html.replace(head, '');
    assert.doesNotMatch(outsideHead, /<!-- quiet:analytics:(?:start|end) -->/,
      `${relative}: analytics exception markers must stay in head`);
    assert.ok(count(head, /<!-- quiet:analytics:start -->/g) <= 1,
      `${relative}: analytics exception may appear at most once`);
    assert.equal(count(head, /<!-- quiet:analytics:start -->/g),
      count(head, /<!-- quiet:analytics:end -->/g),
      `${relative}: analytics exception markers are unbalanced`);
    const checkedHead = head.replace(
      /<!-- quiet:analytics:start -->[\s\S]*?<!-- quiet:analytics:end -->/,
      ''
    );
    assert.doesNotMatch(checkedHead, /<!-- quiet:analytics:(?:start|end) -->/,
      `${relative}: malformed analytics exception markers`);
    runtimeHtml = html.replace(head, checkedHead);
  }

  for (const match of html.matchAll(/\s(?:href|src)=["']([^"']+)["']/g)) {
    const reference = match[1];
    if (/^(?:mailto:|tel:|data:|javascript:)/i.test(reference)) continue;
    if (/^https?:/i.test(reference) && new URL(reference).origin !== SITE_URL.origin) continue;
    references += 1;
    const target = outputPath(file, reference);
    if (!target) continue;
    assert.ok(target === ROOT || target.startsWith(`${ROOT}${path.sep}`),
      `${relative}: reference escapes output: ${reference}`);
    assert.ok(isFile(target), `${relative}: missing local reference ${reference}`);
    assert.ok(isServableFile(target),
      `${relative}: reference ${reference} differs in letter case from the file on disk. ` +
      'It resolves here and 404s on a case-sensitive host like GitHub Pages.');

    const fragment = reference.includes('#') ? decodeURIComponent(reference.split('#').pop()) : '';
    if (fragment && target.endsWith('.html')) {
      const targetHtml = target === file ? html : fs.readFileSync(target, 'utf8');
      const targetIds = new Set([...targetHtml.matchAll(/\sid=["']([^"']+)["']/g)].map((item) => item[1]));
      assert.ok(targetIds.has(fragment), `${relative}: missing fragment ${reference}`);
    }
  }

  for (const match of runtimeHtml.matchAll(/<(script|img|iframe|source|video|audio)\b[^>]*\s(?:src|href)=["']([^"']+)["']/gi)) {
    const reference = match[2];
    if (/^https?:/i.test(reference)) {
      assert.equal(new URL(reference).origin, SITE_URL.origin,
        `${relative}: third-party runtime request ${reference}`);
    }
  }
  for (const match of runtimeHtml.matchAll(/<link\b([^>]*\brel=["'](?:stylesheet|icon|preload|modulepreload)["'][^>]*)>/gi)) {
    const reference = match[1].match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (reference && /^https?:/i.test(reference)) {
      assert.equal(new URL(reference).origin, SITE_URL.origin,
        `${relative}: third-party linked resource ${reference}`);
    }
  }

  for (const json of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    assert.doesNotThrow(() => JSON.parse(json[1]), `${relative}: invalid JSON-LD`);
  }
}

const home = generatedHome;
assert.match(home, /class="wordmark"[^>]*aria-current="page"/, 'home wordmark must expose current location');

// The archive is the only page that lists everything, so it is the only thing standing
// between a published post and a post nobody can find. Nothing asserted it listed
// anything at all, which a template that silently stopped rendering the list would pass.
const archive = fs.readFileSync(path.join(ROOT, 'archive/index.html'), 'utf8');
const archiveLinks = new Set(
  [...archive.matchAll(/<ul class="archive-list">([\s\S]*?)<\/ul>/g)]
    .flatMap((list) => [...list[1].matchAll(/<a href="([^"]+)"/g)])
    .map((match) => decodeURIComponent(match[1]))
);
const postPages = files
  .filter((file) => /\d{4}[\\/][^\\/]+[\\/]index\.html$/.test(path.relative(ROOT, file)))
  .map((file) => `${BASEURL}/${path.relative(ROOT, path.dirname(file)).split(path.sep).join('/')}/`);
for (const url of postPages) {
  assert.ok(archiveLinks.has(url),
    `archive does not link ${url}; a published post nothing links to cannot be found`);
}
assert.equal(archiveLinks.size, postPages.length,
  `archive lists ${archiveLinks.size} posts but ${postPages.length} post pages were built`);
const referencePath = path.join(ROOT, '2026/everything-a-post-can-do/index.html');
if (EXPECT_DEMO) {
  const referencePost = fs.readFileSync(referencePath, 'utf8');
  assert.match(referencePost, /<h3 id="deep-links" class="reference-heading">Headings get anchors<a class="anchor" href="#deep-links" aria-hidden="true" tabindex="-1">#<\/a><\/h3>/,
    'heading anchors must preserve custom ids and classes, and stay out of the accessibility tree');
  const toc = referencePost.match(/<nav class="toc"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.doesNotMatch(toc, /href="#deep-links"/,
    'h3 headings must keep anchors but stay out of the h2-only contents list');
  assert.match(referencePost, /<div class="table-wrap" tabindex="0"><table(?:\s[^>]*)?>/,
    'tables must receive a keyboard-scroll wrapper');
  assert.match(referencePost, /assets\/js\/copy\.js\?v=\d+/, 'copy script must be build-versioned');
}

if (EXPECT_DEMO) {
  const generated = files
    .filter((file) => /\.(?:html|xml)$/.test(file))
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
  assert.doesNotMatch(generated, /Your Name|username\.github\.io/, 'production demo leaked template placeholders');
  assert.match(home, /template demo · sample content · built with substantial AI assistance/,
    'production demo must identify its status and AI involvement');
}

// Two budgets per asset, because they answer two different questions.
//
// The compressed size is what a reader actually waits for; every static host
// worth using serves these gzipped or better. That is the real budget.
//
// The raw size is a ceiling on the source, so the file cannot quietly balloon
// between releases. It is set with room to spare on purpose: a single raw
// budget makes deleting an explanatory comment the cheapest way to pass, and
// in a template meant to be read and changed by hand, the comments are the
// part worth keeping. Measure what the reader pays; cap what the author writes.
const gzip = (file) => zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length;

// Budget everything the build actually emits, plus the one script that is inlined into
// the document rather than served. Naming three files instead meant a fourth stylesheet
// or a second script would have shipped entirely unmeasured.
const shipped = files.filter((file) => /\.(?:css|js)$/.test(file));
// docs/ACCEPTANCE.md is the ledger: what these numbers are, when they moved and
// what the move bought is recorded there and nowhere else. Copying the figures
// here as prose produced three versions of them, no two agreeing and none
// current — a budget documented in three places is a budget documented nowhere.
// The PASS line below prints the live utilisation instead, so the real number is
// in front of whoever runs the suite rather than in a comment that rots.
const BUDGETS = { css: { raw: 32 * 1024, wire: 10 * 1024 }, js: { raw: 4 * 1024, wire: 2 * 1024 } };
const totals = { css: { raw: 0, wire: 0 }, js: { raw: 0, wire: 0 } };
for (const file of shipped) {
  const kind = file.endsWith('.css') ? 'css' : 'js';
  totals[kind].raw += fs.statSync(file).size;
  totals[kind].wire += gzip(file);
}
// theme.js is inlined into every page, so its cost is per-document, not per-asset.
const themeSource = path.join(__dirname, '..', '_includes/theme.js');
const themeRaw = fs.statSync(themeSource).size;
const themeWire = gzip(themeSource);
assert.ok(themeRaw <= 1024, `inline theme JS source budget exceeded: ${themeRaw} B > 1024 B`);
assert.ok(themeWire <= 512, `inline theme JS transfer budget exceeded: ${themeWire} B gzipped > 512 B`);
for (const [kind, budget] of Object.entries(BUDGETS)) {
  assert.ok(totals[kind].raw <= budget.raw,
    `${kind.toUpperCase()} source budget exceeded across ${shipped.length} files: ${totals[kind].raw} B > ${budget.raw} B`);
  assert.ok(totals[kind].wire <= budget.wire,
    `${kind.toUpperCase()} transfer budget exceeded: ${totals[kind].wire} B gzipped > ${budget.wire} B`);
}
const cssBytes = totals.css.raw;
const wireBytes = totals.css.wire + totals.js.wire + themeWire;

const headersPath = path.join(ROOT, '_headers');
if (EXPECT_CLOUDFLARE) {
  const headers = fs.readFileSync(headersPath, 'utf8');
  assert.match(headers, /Cache-Control: max-age=0, must-revalidate, no-transform/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /Permissions-Policy: camera=\(\), geolocation=\(\), microphone=\(\)/);
  assert.match(headers, /\/assets\/css\/\*\s+! Cache-Control\s+Cache-Control: public, max-age=31536000, immutable, no-transform/);
  assert.match(headers, /\/assets\/js\/\*\s+! Cache-Control\s+Cache-Control: public, max-age=31536000, immutable, no-transform/);
} else {
  assert.equal(fs.existsSync(headersPath), false,
    'generic output leaked Cloudflare-specific response-header syntax');
}

const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
assert.match(robots, new RegExp(`${SITE_URL.origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${BASEURL}/sitemap\\.xml`));

const pct = (used, limit) => `${Math.round((used / limit) * 100)}%`;
process.stdout.write(
  `PASS generated site: ${htmlFiles.length} HTML files, ${references} local references\n` +
  `     CSS  ${totals.css.raw} B raw (${pct(totals.css.raw, BUDGETS.css.raw)} of budget), ` +
  `${totals.css.wire} B gzipped (${pct(totals.css.wire, BUDGETS.css.wire)})\n` +
  `     JS   ${totals.js.raw} B raw (${pct(totals.js.raw, BUDGETS.js.raw)}), ` +
  `${totals.js.wire} B gzipped (${pct(totals.js.wire, BUDGETS.js.wire)}), ` +
  `plus ${themeWire} B inlined per page\n`
);
