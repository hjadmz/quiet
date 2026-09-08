'use strict';

// Exercise the public-demo branches with the template's real sample posts and
// synthetic identity. Ordinary fork verification does not require those posts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run, bundle, jekyllBuild } = require('./run.cjs');

const ROOT = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'quiet-demo-'));
const source = path.join(temporary, 'source');
const DEMO = {
  title: 'quiet demo',
  author: { name: 'Demo Author' },
  url: 'https://quiet-demo.example',
  baseurl: '/demo',
  tagline: 'A configured example of the reading template.',
  description: 'Sample posts demonstrating the Quiet blog template.',
  include: ['_headers'],
  demo_notice: 'template demo · sample content · built with substantial AI assistance'
};

function build(name, changes = {}) {
  const config = path.join(temporary, `${name}.yml`);
  fs.writeFileSync(config, JSON.stringify({ ...DEMO, ...changes }));
  const destination = path.join(temporary, name);
  jekyllBuild({
    source,
    destination,
    config: [path.join(source, '_config.yml'), path.join(source, 'tests/fixture.yml'), config],
    cwd: ROOT
  });
  return {
    SITE_ROOT: destination,
    SITE_URL: DEMO.url,
    SITE_BASEURL: DEMO.baseurl,
    EXPECT_DEMO: '1',
    EXPECT_CLOUDFLARE: '1',
    // CI grants the mother template an exemption; this configured fixture must
    // reject placeholders even when that exemption is present in the parent.
    QUIET_EXPECT_PLACEHOLDER: '0',
    QUIET_ALLOW_CONFIG_PROBLEMS: '0'
  };
}

function nodeCheck(name, env) {
  return run(process.execPath, [path.join(source, 'tests', name)], { cwd: ROOT, env });
}

function expectRejection(check, message) {
  let failure;
  try { check(); } catch (error) { failure = error; }
  assert.ok(failure, `the configured-demo check must reject ${message}`);
  assert.match(`${failure.stdout || ''}${failure.stderr || ''}`, message,
    'the negative fixture must fail for its intended reason');
}

try {
  fs.cpSync(ROOT, source, {
    recursive: true,
    filter: (file) => !new Set([
      '.git', '.bundle', '.jekyll-cache', '_site', '_site-test', '_site-subpath',
      'node_modules', 'vendor'
    ]).has(path.relative(ROOT, file).split(path.sep)[0])
  });

  const configured = build('configured');
  nodeCheck('config-lint.cjs', configured);
  nodeCheck('site-smoke.cjs', configured);
  bundle(['exec', 'ruby', path.join(source, 'tests/feed-smoke.rb')], {
    cwd: ROOT,
    env: configured
  });

  const undisclosed = build('undisclosed', { demo_notice: '' });
  expectRejection(() => nodeCheck('site-smoke.cjs', undisclosed),
    /production demo must identify its status and AI involvement/);

  const placeholder = build('placeholder', { author: { name: 'Your Name' } });
  expectRejection(() => nodeCheck('config-lint.cjs', placeholder),
    /author\.name is still the template's placeholder/);
  expectRejection(() => nodeCheck('site-smoke.cjs', placeholder),
    /production demo leaked template placeholders/);

  process.stdout.write('PASS configured demo: strict identity, sample routes and content, ' +
    'subpath URLs, headers, full Atom feed, and rejection of missing disclosure or placeholders\n');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
