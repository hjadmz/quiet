'use strict';

// Reads the config report out of the built site and fails if it is not empty.
//
// The rules live in _includes/config.html and nowhere else. This file does not
// restate them — it reads the page they already generate, so a rule can never
// drift between what the site does and what CI checks.
//
// It then adds the one guarantee Liquid cannot make. jekyll-seo-tag prints
// site.lang and site.author.name into meta tags without escaping them, so a
// quote in either escapes its attribute no matter what the templates do. The
// template itself ships zero inline event handlers and exactly one inline
// <style>, so anything else in the output is a value that broke out of its
// context — including from a plugin this repo does not control.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(process.env.SITE_ROOT || path.join(__dirname, '..', '_site'));

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

// ---- 1. the config report the site generated for itself ----

const reportPath = path.join(ROOT, 'site-check', 'index.html');
assert.ok(
  fs.existsSync(reportPath),
  'site-check/index.html is missing from the build. It is how an author with no local ' +
  'toolchain finds out a setting was rejected or two posts collided; if you deleted ' +
  'the page on purpose, delete this check too.'
);

// The report is HTML, so its text is escaped. Decode the handful of entities the
// messages can contain, or a terminal prints "&quot;" at the reader.
const decode = (text) => text
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#8217;/g, '\u2019');

const report = fs.readFileSync(reportPath, 'utf8');
const problems = [...report.matchAll(/<ol class="config-problems">([\s\S]*?)<\/ol>/g)]
  .flatMap((list) => [...list[1].matchAll(/<li>([\s\S]*?)<\/li>/g)])
  .map((match) => decode(match[1].replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim())
  .filter(Boolean);

// tests/config-hostile.cjs deliberately builds broken configs and expects problems to
// be reported, but still needs the output-safety half below.
const ALLOW_PROBLEMS = process.env.QUIET_ALLOW_CONFIG_PROBLEMS === '1';

// The shipped config still carries the template's own placeholder identity, and
// /site-check/ reports it. `npm run doctor` MUST report it too: it is the one
// warning that matters most before a first push, and a tool that stays quiet
// about the exact state it was built to catch is worse than no tool.
//
// This repo's own suites build that shipped config on purpose, so they set
// QUIET_EXPECT_PLACEHOLDER to say "yes, this fixture is the template itself".
// The exemption belongs to the fixture, not to the check — silencing the check
// was the earlier, wrong shape of this fix.
const EXPECTED_PLACEHOLDER = /^Still set to the template's placeholder/;
const expectPlaceholder = process.env.QUIET_EXPECT_PLACEHOLDER === '1';
const unexpected = expectPlaceholder
  ? problems.filter((p) => !EXPECTED_PLACEHOLDER.test(p))
  : problems;

// ---- 2. posts that will never appear, which the site cannot report on itself ----
//
// Jekyll decides what counts as a post before any template runs, so a file it
// rejects is invisible to Liquid and cannot be listed at /site-check/. Both of
// these are quiet, total losses: the author writes a post, pushes, and it is
// simply not there. (Confirmed the hard way — a future-dated fixture vanished
// mid-session while testing something else.)

const postsDir = path.join(__dirname, '..', '_posts');
const invisible = [];
if (fs.existsSync(postsDir)) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  for (const name of fs.readdirSync(postsDir)) {
    if (!/\.(?:md|markdown|html)$/i.test(name)) continue;
    const dated = name.match(/^(\d{4})-(\d{2})-(\d{2})-/);
    if (!dated) {
      invisible.push(`${name} — no date at the front of the filename, so Jekyll ` +
        'does not treat it as a post at all. Rename it YYYY-MM-DD-title.md.');
      continue;
    }
    const [, year, month, day] = dated;
    const when = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (when > today) {
      invisible.push(`${name} — dated ${year}-${month}-${day}, which is in the future, ` +
        'so it stays hidden until a build happens on or after that day. Nothing ' +
        'rebuilds a static site on a schedule unless you set that up.');
    }
  }
}


// ---- 3. one report, both kinds ----

if ((unexpected.length > 0 || invisible.length > 0) && !ALLOW_PROBLEMS) {
  if (unexpected.length > 0) {
    process.stderr.write(
      `\nsite check found ${unexpected.length} problem${unexpected.length > 1 ? 's' : ''}. ` +
      'The site still builds, but not as written:\n\n'
    );
    for (const problem of unexpected) process.stderr.write(`  • ${problem}\n`);
  }
  if (invisible.length > 0) {
    process.stderr.write(
      `\n${invisible.length} file${invisible.length > 1 ? 's' : ''} in _posts/ ` +
      'will not appear on the site at all:\n\n'
    );
    for (const line of invisible) process.stderr.write(`  • ${line}\n`);
  }
  process.stderr.write('\n');
  process.exit(1);
}

// ---- 4. nothing escaped its attribute anywhere in the output ----

const generated = walk(ROOT).filter((file) => /\.(?:html|xml)$/.test(file));
let inlineStyles = 0;

for (const file of generated) {
  const relative = path.relative(ROOT, file);
  const source = fs.readFileSync(file, 'utf8');

  const handler = source.match(/\s(on[a-z]+)\s*=\s*["']/i);
  assert.equal(
    handler,
    null,
    `${relative}: inline event handler ${handler && handler[1]}. quiet writes none, so a ` +
    'config value escaped its attribute — check lang and author.name in _config.yml, ' +
    'which jekyll-seo-tag prints unescaped.'
  );

  // The accent block is the only <style> the template emits, and only when the
  // accent is set. A second one means a value closed the first.
  const styles = [...source.matchAll(/<style[\s>]/gi)].length;
  assert.ok(styles <= 1, `${relative}: ${styles} inline <style> elements; quiet emits at most one`);
  inlineStyles += styles;

  for (const block of source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    const css = block[1];
    const opens = (css.match(/\{/g) || []).length;
    const closes = (css.match(/\}/g) || []).length;
    assert.equal(opens, closes, `${relative}: inline CSS has unbalanced braces — the accent value broke out`);
    assert.doesNotMatch(css, /<\/?[a-z]/i, `${relative}: inline CSS contains markup`);
  }
}

process.stdout.write(
  `PASS config: ${ALLOW_PROBLEMS ? `${problems.length} problems reported as expected` : 'no problems reported'}, ` +
  `${invisible.length === 0 ? 'every post visible' : `${invisible.length} posts invisible`}, ` +
  `${generated.length} generated files clean, ` +
  `${inlineStyles} inline style block${inlineStyles === 1 ? '' : 's'}\n`
);
