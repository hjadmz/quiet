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
    [/^  name: .*$/m, '  name: Example Writer'],
    [/^url: .*$/m, 'url: https://reader.example'],
    [/^tagline: .*$/m, 'tagline: "notes on making useful things"'],
    [/^description: .*$/m, 'description: "Independent notes on design and software."'],
    [/^theme_default: .*$/m, 'theme_default: dark'],
    [/^show_reading_time: .*$/m, 'show_reading_time: false'],
  ];
  for (const [pattern, replacement] of replacements) {
    assert.match(config, pattern, `fixture could not find ${pattern}`);
    config = config.replace(pattern, replacement);
  }
  fs.writeFileSync(configPath, config);

  // A real generated site owns its About page too. Keeping the template's prose
  // while calling the config personalized is the exact stale-identity failure this
  // fixture exists to prevent.
  fs.writeFileSync(path.join(source, 'about.md'), [
    '---',
    'layout: page',
    'title: about',
    'permalink: /about/',
    'description: about this independent site.',
    '---',
    '',
    'This is an independent site made from the quiet template.',
    ''
  ].join('\n'));

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
  node(path.join(source, 'tests/config-lint.cjs'), { SITE_ROOT: path.join(source, '_site') });
  node(path.join(source, 'tests/site-smoke.cjs'), { EXPECT_DEMO: '0', EXPECT_CLOUDFLARE: '0' });
  bundle(['exec', 'ruby', path.join(source, 'tests/feed-smoke.rb')], { cwd: ROOT });
  node(path.join(source, 'tests/edge-cases.cjs'), { QUIET_BUNDLE_CWD: ROOT });

  const generatedIdentity = [
    fs.readFileSync(path.join(source, '_site/index.html'), 'utf8'),
    fs.readFileSync(path.join(source, '_site/about/index.html'), 'utf8'),
    fs.readFileSync(path.join(source, '_site/feed.xml'), 'utf8')
  ].join('\n');
  for (const leftover of [
    'Your Name',
    'username.github.io',
    "everything it needs, nothing it doesn't.",
    'a quiet blog template for GitHub Pages.'
  ]) {
    assert.equal(generatedIdentity.includes(leftover), false,
      `personalized fork still publishes template identity: ${leftover}`);
  }

  // The command the README hands a fork must not pin an origin.
  //
  // It did. `verify` passed SITE_URL=https://username.github.io, so the moment an
  // author set their own `url` in _config.yml — step 2 of the quickstart — their own
  // CI failed with "generated home canonical uses https://theirsite, expected
  // https://username.github.io". The template shipped a workflow that punished people
  // for using the template. site-smoke already falls back to the site's own canonical
  // when SITE_URL is unset, so the check was always right; only the caller was wrong.
  //
  // The build above proves the behaviour end to end with url: https://reader.example.
  // This proves the scripts a fork actually runs cannot reintroduce the pin, which the
  // build cannot: it invokes the harnesses directly rather than through npm.
  const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts;
  for (const name of ['verify', 'doctor', 'test:compat', 'test:edge', 'test:portable', 'test:config']) {
    assert.doesNotMatch(scripts[name] || '', /SITE_URL=https?:\/\//,
      `${name} pins a site origin. A fork runs this against its own site, so any ` +
      'literal origin here fails for everyone except this repository. The host-overlay ' +
      'script (verify:cloudflare) and self-contained fixtures may pin one, because the ' +
      'origin they pin is the reserved example name the overlay itself carries.');
  }

  process.stdout.write(
    'PASS portable fork: no demo posts or Cloudflare overlay, personalized config and ' +
    'About page, no template identity, and no shipped script pins an origin\n'
  );
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
