'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { jekyllBuild } = require('./run.cjs');

const ROOT = path.resolve(__dirname, '..');
const BUNDLE_CWD = process.env.QUIET_BUNDLE_CWD
  ? path.resolve(process.env.QUIET_BUNDLE_CWD)
  : ROOT;
const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'quiet-edge-'));
const source = path.join(temporary, 'source');
const output = path.join(temporary, 'site');

try {
  fs.cpSync(ROOT, source, {
    recursive: true,
    filter: (file) => {
      const relative = path.relative(ROOT, file);
      const first = relative.split(path.sep)[0];
      return !new Set(['.git', '.bundle', '.jekyll-cache', '_site', 'node_modules', 'vendor']).has(first);
    }
  });

  fs.rmSync(path.join(source, '_posts'), { recursive: true, force: true });
  fs.mkdirSync(path.join(source, '_posts'), { recursive: true });
  fs.mkdirSync(path.join(source, 'assets/img'), { recursive: true });
  fs.copyFileSync(
    path.join(source, 'tests/fixtures/reference-image.svg'),
    path.join(source, 'assets/img/reference-image.svg')
  );
  fs.writeFileSync(path.join(source, '_posts/2026-08-01-image-only.md'), `---
title: image only
description: verifies the minimum reading time.
---

<img src="/assets/img/reference-image.svg" alt="" width="1200" height="675">
`);
  fs.writeFileSync(path.join(source, '_posts/2026-08-02-empty-description.md'), `---
title: no description separator
description: ""
---

The home list should show only this post's date.
`);

  jekyllBuild({
    source,
    destination: output,
    config: [path.join(source, '_config.yml'), path.join(source, 'tests/fixture.yml')],
    cwd: BUNDLE_CWD
  });

  const imageOnly = fs.readFileSync(path.join(output, '2026/image-only/index.html'), 'utf8');
  assert.match(imageOnly, /· 1 min read/, 'image-only posts need a one-minute minimum');
  assert.doesNotMatch(imageOnly, /0 min read/, 'reading time must never be zero');

  const home = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  const item = home.match(/<li>\s*<a[^>]*>no description separator<\/a>([\s\S]*?)<\/li>/);
  assert.ok(item, 'empty-description fixture is missing from the home list');
  assert.doesNotMatch(item[1], / — /, 'an empty description must not leave a dangling separator');

  const postCount = (home.match(/<li>\s*<a/g) || []).length;
  assert.ok(postCount >= 1, 'home must show at least one post');

  // ---- day one in a fork ----
  //
  // The first two things anyone does with a template are delete the demo posts and
  // decide whether they want an /about/ page. An empty site was already fine; the
  // deleted page was not. The nav links were hardcoded, so removing about.md left a
  // dead link in the header of *every* page while the build stayed green and said
  // nothing — and the README is right that a hosted fork never runs this suite, so
  // the link checker could not be the answer. The header now links to a page only
  // when that page is in the build, and /site-check/ names the one that went so an
  // accidental deletion is not silent either.
  const forkSource = path.join(temporary, 'fork');
  const forkOutput = path.join(temporary, 'fork-site');
  fs.cpSync(source, forkSource, { recursive: true });
  fs.rmSync(path.join(forkSource, 'about.md'), { force: true });
  fs.writeFileSync(path.join(forkSource, 'CNAME'), 'reader.example\n');
  for (const name of fs.readdirSync(path.join(forkSource, '_posts'))) {
    fs.rmSync(path.join(forkSource, '_posts', name), { force: true });
  }

  jekyllBuild({
    source: forkSource,
    destination: forkOutput,
    config: [path.join(forkSource, '_config.yml')],
    cwd: BUNDLE_CWD
  });

  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => entry.isDirectory()
      ? walk(path.join(dir, entry.name))
      : [path.join(dir, entry.name)]);

  const forkHome = fs.readFileSync(path.join(forkOutput, 'index.html'), 'utf8');
  assert.match(forkHome, /nothing here yet/,
    'a site with no posts yet needs a real empty state, not a blank column');
  assert.match(forkHome, /href="[^"]*\/archive\/"/,
    'the archive link must survive — only the deleted page loses its link');

  const forkArchive = fs.readFileSync(path.join(forkOutput, 'archive/index.html'), 'utf8');
  assert.match(forkArchive, /nothing here yet/, 'the archive needs the same empty state');

  for (const file of walk(forkOutput).filter((name) => name.endsWith('.html'))) {
    assert.doesNotMatch(
      fs.readFileSync(file, 'utf8'),
      /href="[^"]*\/about\/"/,
      `${path.relative(forkOutput, file)} links to /about/, which this fork deleted. ` +
      'A hardcoded nav link puts that 404 on every page of the site.'
    );
  }

  const forkCheck = fs.readFileSync(path.join(forkOutput, 'site-check/index.html'), 'utf8');
  assert.match(forkCheck, /about\.md/,
    'site-check must name the page the header expected, so removing one is not silent');
  assert.doesNotMatch(forkCheck, /<code>\/CNAME<\/code>/,
    'a GitHub Pages custom-domain file is expected infrastructure, not stray output');
  assert.equal(fs.readFileSync(path.join(forkOutput, 'CNAME'), 'utf8'), 'reader.example\n',
    'ignoring CNAME in the report must not keep GitHub Pages from publishing it');

  const forkFeed = fs.readFileSync(path.join(forkOutput, 'feed.xml'), 'utf8');
  assert.match(forkFeed, /<feed[\s>]/, 'the feed must still be valid Atom with no posts');
  assert.doesNotMatch(forkFeed, /<entry>/, 'no posts means no entries, not a broken feed');

  process.stdout.write(
    'PASS edge-case build: minimum reading time, empty descriptions, ' +
    'and a day-one fork with a custom domain, no posts, and no about page\n'
  );
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
