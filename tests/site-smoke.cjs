'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
  'tests'
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
const referencePath = path.join(ROOT, '2026/everything-a-post-can-do/index.html');
if (EXPECT_DEMO) {
  const referencePost = fs.readFileSync(referencePath, 'utf8');
  assert.match(referencePost, /<h3 id="deep-links" class="reference-heading">Headings get anchors<a class="anchor" href="#deep-links" aria-label="permalink to Headings get anchors">#<\/a><\/h3>/,
    'heading anchors must preserve custom ids and classes');
  assert.match(referencePost, /<a href="#deep-links">Headings get anchors<\/a>/,
    'TOC must preserve custom heading ids');
  assert.match(referencePost, /<div class="table-wrap" role="region" aria-label="scrollable table" tabindex="0"><table class="wide">/,
    'table wrapper must preserve table attributes');
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

const cssBytes = fs.statSync(path.join(ROOT, 'assets/css/main.css')).size;
const copyBytes = fs.statSync(path.join(ROOT, 'assets/js/copy.js')).size;
const themeBytes = fs.statSync(path.join(__dirname, '..', '_includes/theme.js')).size;
assert.ok(cssBytes <= 20 * 1024, `CSS budget exceeded: ${cssBytes} B > 20 KiB`);
assert.ok(copyBytes <= 2 * 1024, `copy JS budget exceeded: ${copyBytes} B > 2 KiB`);
assert.ok(themeBytes <= 1024, `theme JS budget exceeded: ${themeBytes} B > 1 KiB`);

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

process.stdout.write(
  `PASS generated site: ${htmlFiles.length} HTML files, ${references} local references, ` +
  `${cssBytes} B CSS, ${themeBytes + copyBytes} B JS\n`
);
