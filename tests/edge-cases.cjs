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

  process.stdout.write('PASS edge-case build: minimum reading time and empty descriptions\n');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
