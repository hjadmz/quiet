'use strict';

// Builds the template at every shape of address a fork can actually be served from,
// and runs the full generated-site, config and feed checks against each one.
//
// This replaces a single hardcoded subpath run. The template is meant to work at
// `you.github.io`, at `you.github.io/blog`, at `yourdomain.com` and at
// `yourdomain.org/blog`, and the difference between those is two settings — `url`
// and `baseurl` — that every absolute link, canonical tag, feed entry and sitemap
// URL depends on. Checking one of the four proved one of the four.
//
// The check the single run could not make is the last one here: after each build,
// the output is scanned for any origin other than its own. A hardcoded host does
// not announce itself — the site still builds, still passes its own link checks,
// and simply points a fork's readers at somebody else's domain. The placeholder in
// _config.yml is the likeliest one to leak, so it is in the list even though no
// shape below uses it.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run, jekyllBuild } = require('./run.cjs');

const ROOT = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'quiet-origins-'));

// Every origin the repository knows about. Each build must contain its own and no
// other: `username.github.io` is the shipped placeholder, `reader.example` is the
// host overlay's example, and the rest belong to the other rows of this matrix.
const KNOWN_ORIGINS = [
  'username.github.io',
  'reader.example',
  'someone.github.io',
  'example.org',
  'example.com'
];

const SHAPES = [
  { slug: 'gh-user', name: 'a user site at a github.io root', url: 'https://someone.github.io', baseurl: '' },
  { slug: 'gh-project', name: 'a project site in a github.io subfolder', url: 'https://someone.github.io', baseurl: '/blog' },
  { slug: 'domain-root', name: 'a custom domain at the root', url: 'https://example.org', baseurl: '' },
  { slug: 'domain-sub', name: 'a custom domain in a subfolder', url: 'https://example.org', baseurl: '/blog' }
];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function node(script, env) {
  return run(process.execPath, [script], { cwd: ROOT, env });
}

try {
  for (const shape of SHAPES) {
    const overlay = path.join(temporary, `${shape.slug}.yml`);
    // baseurl is quoted so an empty value stays a string rather than becoming nil,
    // which is the difference between "/" and "//" in front of every link.
    fs.writeFileSync(overlay, `url: "${shape.url}"\nbaseurl: "${shape.baseurl}"\n`);
    const destination = path.join(temporary, shape.slug);

    jekyllBuild({
      cwd: ROOT,
      destination,
      config: ['_config.yml', overlay]
    });

    const env = {
      SITE_ROOT: destination,
      SITE_URL: shape.url,
      SITE_BASEURL: shape.baseurl,
      EXPECT_DEMO: '0',
      EXPECT_CLOUDFLARE: '0',
      // The shipped config still carries the template's placeholder author, which
      // /site-check/ reports on purpose. Overriding url does not change that.
      QUIET_EXPECT_PLACEHOLDER: '1'
    };

    node(path.join(ROOT, 'tests', 'site-smoke.cjs'), env);
    node(path.join(ROOT, 'tests', 'config-lint.cjs'), env);
    run('bundle', ['exec', 'ruby', path.join(ROOT, 'tests', 'feed-smoke.rb')], { cwd: ROOT, env });

    // Nothing may point at an origin this build was not given.
    const own = shape.url.replace(/^https?:\/\//, '');
    const foreign = KNOWN_ORIGINS.filter((origin) => origin !== own);
    const leaks = [];
    for (const file of walk(destination).filter((f) => /\.(?:html|xml|txt|json)$/.test(f))) {
      const source = fs.readFileSync(file, 'utf8');
      for (const origin of foreign) {
        if (source.includes(origin)) leaks.push(`${path.relative(destination, file)} → ${origin}`);
      }
    }
    assert.deepEqual(leaks, [],
      `${shape.name}: the build points at an origin it was never given. A hardcoded ` +
      'host does not announce itself — the site builds, passes its own link checks, ' +
      "and sends a fork's readers somewhere else.");

    // A scan that finds nothing proves nothing. The same files must carry this
    // build's own origin, or the check above was reading pages with no absolute
    // URLs in them and would have passed a hardcoded host just as quietly.
    let ownHits = 0;
    for (const file of walk(destination).filter((f) => /\.(?:html|xml)$/.test(f))) {
      const source = fs.readFileSync(file, 'utf8');
      ownHits += source.split(own).length - 1;
    }
    assert.ok(ownHits > 0,
      `${shape.name}: no absolute URL anywhere in the output uses this build's own ` +
      'origin, so the foreign-origin scan above had nothing to find either.');

    process.stdout.write(`  ${shape.name.padEnd(42)} ${(shape.url + shape.baseurl).padEnd(32)} ${ownHits} own-origin URLs, 0 foreign\n`);
  }

  process.stdout.write(
    `PASS origins: ${SHAPES.length} address shapes build, link, canonicalise and ` +
    'syndicate correctly, and none leaks a foreign origin\n'
  );
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
