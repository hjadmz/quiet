'use strict';

// Builds a site with hundreds of posts and checks the parts that only break at size.
//
// A template that is pleasant with three posts and unusable with five hundred has
// not been tested, it has been demonstrated. This was measured once by hand early
// on and then written down in prose, which is the same as not having checked it:
// nothing would have failed if a later change made the archive quadratic or made
// the home page list every post ever written.
//
// The specific claim under test is the one that replaces a search box. quiet has
// no search, on the grounds that the archive lists every post with its description
// and the browser's own find-in-page is better than a bad site search — it is
// already familiar, already keyboard-driven, and cannot return zero results for a
// word that is visibly on the page. That argument is only honest if every post's
// title *and* description are really in the archive's text at full size. So that is
// asserted directly, per post, rather than assumed from a design principle.
//
// Set QUIET_SCALE_POSTS to change the count (default 500).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { jekyllBuild } = require('./run.cjs');

const ROOT = path.resolve(__dirname, '..');
const COUNT = Number(process.env.QUIET_SCALE_POSTS || 500);
const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'quiet-scale-'));
const source = path.join(temporary, 'source');
const destination = path.join(temporary, 'site');

// Distinctive words, so "is this post findable" is a real question and not a
// coincidence of shared vocabulary.
const NOUNS = ['lantern', 'harbour', 'gradient', 'anvil', 'meridian', 'thicket',
  'cadence', 'quarry', 'lattice', 'ember', 'plinth', 'saffron'];

function postFor(index) {
  const noun = NOUNS[index % NOUNS.length];
  const slug = `scale-${noun}-${index}`;
  // Dates walk backwards from a fixed day so nothing lands in the future, which
  // Jekyll would silently drop from the build.
  const day = new Date(Date.UTC(2026, 0, 1) - index * 86400000).toISOString().slice(0, 10);
  return {
    index,
    slug,
    file: `${day}-${slug}.md`,
    title: `${noun} number ${index}`,
    // The description is what the archive carries, and therefore what find-in-page
    // has to work with. Give each one a token that exists nowhere else.
    description: `a distinct sentence about ${noun} ${index} and nothing else.`
  };
}

function bytes(n) {
  return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`;
}

try {
  fs.cpSync(ROOT, source, {
    recursive: true,
    filter: (file) => {
      const first = path.relative(ROOT, file).split(path.sep)[0];
      return !new Set([
        '.git', '.bundle', '.jekyll-cache', '_site', '_site-subpath',
        '_site-test', 'node_modules', 'vendor'
      ]).has(first);
    }
  });

  const posts = Array.from({ length: COUNT }, (unused, i) => postFor(i));
  const postsDir = path.join(source, '_posts');
  fs.rmSync(postsDir, { recursive: true, force: true });
  fs.mkdirSync(postsDir, { recursive: true });
  for (const post of posts) {
    fs.writeFileSync(path.join(postsDir, post.file),
      `---\ntitle: ${JSON.stringify(post.title)}\n` +
      `description: ${JSON.stringify(post.description)}\n---\n\n` +
      `Body text for ${post.slug}.\n`);
  }

  const started = Date.now();
  jekyllBuild({ cwd: source, source, destination });
  const buildMs = Date.now() - started;

  const read = (...parts) => fs.readFileSync(path.join(destination, ...parts), 'utf8');

  // ---- every post exists ----
  const missing = posts.filter((post) => {
    const year = post.file.slice(0, 4);
    return !fs.existsSync(path.join(destination, year, post.slug, 'index.html'));
  });
  assert.deepEqual(missing.map((p) => p.file), [],
    `posts that did not build at ${COUNT} posts. Jekyll drops a post silently rather ` +
    'than failing, so this is the only place it would ever be noticed.');

  // ---- the archive is the search box, so it has to actually hold everything ----
  const archive = read('archive', 'index.html');
  const unfindable = [];
  for (const post of posts) {
    if (!archive.includes(post.title)) unfindable.push(`${post.slug} (title)`);
    if (!archive.includes(post.description)) unfindable.push(`${post.slug} (description)`);
  }
  assert.deepEqual(unfindable.slice(0, 10), [],
    `${unfindable.length} titles or descriptions are missing from the archive at ` +
    `${COUNT} posts. Refusing to ship a search box is only defensible while ` +
    "find-in-page can reach every post's title and its one-line description.");

  // Find-in-page cannot reach text that is display:none. Nothing in the archive
  // may be hidden that way, or the words are in the file and not on the page.
  assert.doesNotMatch(archive, /display:\s*none/i,
    'the archive hides content with display:none, which find-in-page skips');

  // ---- the home page stays an invitation, not a second archive ----
  const home = read('index.html');
  const listed = (home.match(/class="post-list-title"/g) || []).length;
  assert.ok(listed > 0 && listed <= 20,
    `the home page lists ${listed} posts at ${COUNT} posts; posts_on_home caps at 20`);

  // ---- the feed does not grow without bound ----
  const feed = read('feed.xml');
  const entries = (feed.match(/<entry>/g) || []).length;
  assert.ok(entries > 0 && entries <= 50,
    `the feed carries ${entries} full-content entries at ${COUNT} posts, which is a ` +
    'download every subscriber pays for on every poll');

  // ---- the sitemap still lists the whole site ----
  const sitemap = read('sitemap.xml');
  const urls = (sitemap.match(/<loc>/g) || []).length;
  assert.ok(urls >= COUNT,
    `the sitemap lists ${urls} URLs for ${COUNT} posts; search engines would never ` +
    'be told about the rest');

  const archiveBytes = fs.statSync(path.join(destination, 'archive', 'index.html')).size;
  const homeBytes = fs.statSync(path.join(destination, 'index.html')).size;
  const feedBytes = fs.statSync(path.join(destination, 'feed.xml')).size;

  process.stdout.write(
    `PASS scale: ${COUNT} posts build in ${(buildMs / 1000).toFixed(1)}s — ` +
    `${posts.length} pages, every title and description findable in the archive ` +
    `(${bytes(archiveBytes)}), home lists ${listed}, feed carries ${entries} ` +
    `(${bytes(feedBytes)}), sitemap ${urls} URLs, home ${bytes(homeBytes)}\n`
  );
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
