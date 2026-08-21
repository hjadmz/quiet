'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'quiet-portable-'));
const source = path.join(temporary, 'source');

function run(command, args, env = {}) {
  execFileSync(command, args, {
    cwd: source,
    env: { ...process.env, ...env },
    stdio: 'pipe'
  });
}

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

  fs.rmSync(path.join(source, '_posts'), { recursive: true, force: true });
  fs.rmSync(path.join(source, '_config.cloudflare.yml'), { force: true });

  const configPath = path.join(source, '_config.yml');
  let config = fs.readFileSync(configPath, 'utf8');
  const replacements = [
    [/^title: .*$/m, 'title: averylongunbrokentemplatetitle'],
    [/^tagline: .*$/m, 'tagline: ""'],
    [/^url: .*$/m, 'url: https://reader.example'],
    [/^theme_default: .*$/m, 'theme_default: dark'],
    [/^show_reading_time: .*$/m, 'show_reading_time: false'],
    [/^analytics_html: .*$/m,
      'analytics_html: \'<script async src="https://analytics.example/count.js"></script>\'']
  ];
  for (const [pattern, replacement] of replacements) {
    assert.match(config, pattern, `fixture could not find ${pattern}`);
    config = config.replace(pattern, replacement);
  }
  fs.writeFileSync(configPath, config);

  run('bundle', ['_2.6.9_', 'exec', 'jekyll', 'build', '--strict_front_matter'], {
    JEKYLL_ENV: 'production'
  });
  const home = fs.readFileSync(path.join(source, '_site/index.html'), 'utf8');
  assert.equal((home.match(/<!-- quiet:analytics:start -->/g) || []).length, 1,
    'configured analytics must pass through its one explicit policy boundary');
  assert.match(home, /https:\/\/analytics\.example\/count\.js/,
    'configured analytics script is missing from the generated head');
  run('node', ['tests/site-smoke.cjs'], { EXPECT_DEMO: '0', EXPECT_CLOUDFLARE: '0' });
  run('bundle', ['_2.6.9_', 'exec', 'ruby', 'tests/feed-smoke.rb']);
  run('node', ['tests/edge-cases.cjs']);

  process.stdout.write('PASS portable fork: no demo posts or Cloudflare overlay, supported config edits\n');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
