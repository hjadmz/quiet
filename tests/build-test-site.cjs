'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, '_site-test');
const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'quiet-browser-'));
const source = path.join(temporary, 'source');

try {
  fs.cpSync(ROOT, source, {
    recursive: true,
    filter: (file) => {
      const relative = path.relative(ROOT, file);
      const first = relative.split(path.sep)[0];
      return !new Set([
        '.git', '.bundle', '.jekyll-cache', '_site', '_site-subpath',
        '_site-test', 'node_modules', 'vendor'
      ]).has(first);
    }
  });

  const posts = path.join(source, '_posts');
  fs.rmSync(posts, { recursive: true, force: true });
  fs.mkdirSync(posts, { recursive: true });
  fs.copyFileSync(
    path.join(source, 'tests/fixtures/reference-post.md'),
    path.join(posts, '2026-08-16-everything-a-post-can-do.md')
  );
  const images = path.join(source, 'assets/img');
  fs.mkdirSync(images, { recursive: true });
  fs.copyFileSync(
    path.join(source, 'tests/fixtures/reference-image.svg'),
    path.join(images, 'reference-image.svg')
  );
  fs.rmSync(OUTPUT, { recursive: true, force: true });

  execFileSync('bundle', ['_2.6.9_', 'exec', 'jekyll', 'build',
    '--strict_front_matter', '--source', source, '--destination', OUTPUT,
    '--config', `${path.join(source, '_config.yml')},${path.join(source, 'tests/fixture.yml')}`], {
    cwd: ROOT,
    env: { ...process.env, JEKYLL_ENV: 'production' },
    stdio: 'inherit'
  });
  execFileSync('bundle', ['_2.6.9_', 'exec', 'ruby', 'tests/feed-smoke.rb'], {
    cwd: ROOT,
    env: { ...process.env, SITE_ROOT: OUTPUT, SITE_URL: 'https://example.com' },
    stdio: 'inherit'
  });

  process.stdout.write(`PASS controlled browser fixture: ${OUTPUT}\n`);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
