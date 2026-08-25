'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run, bundle, jekyllBuild } = require('./run.cjs');

const ROOT = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'quiet-portable-'));
const source = path.join(temporary, 'source');

function node(script, env = {}) {
  run('node', [script], { cwd: source, env });
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
  ];
  for (const [pattern, replacement] of replacements) {
    assert.match(config, pattern, `fixture could not find ${pattern}`);
    config = config.replace(pattern, replacement);
  }
  fs.writeFileSync(configPath, config);

  // Analytics is a file edit now, not a config value, so exercise the path an
  // author actually takes: paste the snippet between the markers in the include.
  const analytics = path.join(source, '_includes/analytics.html');
  const before = fs.readFileSync(analytics, 'utf8');
  assert.ok(before.includes('<!-- quiet:analytics:start -->'),
    'the analytics include must ship with its markers, or the instruction to paste between them is wrong');
  fs.writeFileSync(analytics, before.replace(
    '<!-- quiet:analytics:start -->',
    '<!-- quiet:analytics:start -->\n<script async src="https://analytics.example/count.js"></script>'
  ));

  jekyllBuild({ source, destination: path.join(source, '_site'), cwd: ROOT });
  const home = fs.readFileSync(path.join(source, '_site/index.html'), 'utf8');
  assert.equal((home.match(/<!-- quiet:analytics:start -->/g) || []).length, 1,
    'analytics added to the include must pass through its one explicit policy boundary');
  assert.match(home, /https:\/\/analytics\.example\/count\.js/,
    'configured analytics script is missing from the generated head');
  node(path.join(source, 'tests/config-lint.cjs'), { SITE_ROOT: path.join(source, '_site'), QUIET_EXPECT_PLACEHOLDER: '1' });
  node(path.join(source, 'tests/site-smoke.cjs'), { EXPECT_DEMO: '0', EXPECT_CLOUDFLARE: '0' });
  bundle(['exec', 'ruby', path.join(source, 'tests/feed-smoke.rb')], { cwd: ROOT });
  node(path.join(source, 'tests/edge-cases.cjs'), { QUIET_BUNDLE_CWD: ROOT });

  process.stdout.write('PASS portable fork: no demo posts or Cloudflare overlay, supported config edits\n');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
