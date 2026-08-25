'use strict';

// Builds the site with configs a person could plausibly write by accident, plus a few
// nobody would write by accident, and asserts the same thing every time: the site is
// still whole, and the author is told exactly what was wrong.
//
// This is the check the suite was missing. Every other test builds a config that is
// already correct, so a template can pass all of them while shipping a blank page to
// anyone who typed `posts_on_home: -10`.
//
// Each case names the values it sets, how many problems it expects the site to report,
// and a fragment of each message. Asserting the message text keeps the reports useful:
// a rule can silently stop explaining itself, and that would be a regression too.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run, jekyllBuild } = require('./run.cjs');

const ROOT = path.resolve(__dirname, '..');
const BUNDLE_CWD = process.env.QUIET_BUNDLE_CWD ? path.resolve(process.env.QUIET_BUNDLE_CWD) : ROOT;
const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'quiet-hostile-'));
const source = path.join(temporary, 'source');

// Three posts, so "how many did the home page list" is a real assertion.
const POSTS = 3;

const CASES = [
  {
    name: 'a count far above the maximum',
    config: 'posts_on_home: 1000\n',
    homePosts: POSTS,
    problems: ['posts_on_home is 1000, above the maximum of 20', 'an invitation, not a second copy of the archive']
  },
  {
    name: 'a negative count',
    config: 'posts_on_home: -10\n',
    homePosts: 1,
    problems: ['posts_on_home is -10', 'lowest value is 1']
  },
  {
    name: 'a count that is not a number',
    config: 'posts_on_home: abc\n',
    homePosts: POSTS,
    problems: ['posts_on_home is abc, which is not a whole number']
  },
  {
    name: 'zero, an empty value, and a list are each read the same way',
    config: 'posts_on_home: 0\n',
    homePosts: 1,
    problems: ['posts_on_home is 0']
  },
  {
    name: 'every setting hostile at once',
    config: [
      'title: ""',
      'body_font: \'sans" onclick="alert(2)\'',
      'theme_default: PURPLE',
      'accent: \'red} body{display:none} :root{--x:1\'',
      'date_format: ""',
      'show_credit: "false"',
      'show_reading_time: "no"',
      'posts_on_home: [5, 10]',
      'url: https://example.com/',
      'footer:',
      '  github: "https://github.com/someone"',
      '  email: "not an email"',
      ''
    ].join('\n'),
    homePosts: 5 > POSTS ? POSTS : 5,
    problems: [
      'title is empty',
      'body_font is',
      'theme_default is purple',
      'accent contains characters that are not part of a CSS color',
      'date_format is empty',
      'show_credit is “false” rather than false',
      'show_reading_time is “no” rather than false',
      'posts_on_home is a list',
      'url ends with a slash',
      'footer.github is',
      'footer.email is'
    ]
  },
  {
    // Settings that were removed. Ignoring a line someone already wrote is the
    // failure mode this whole reporting mechanism exists to prevent, and it is
    // what makes pruning the config surface safe rather than rude.
    name: 'settings that no longer exist',
    config: [
      'accent_dark: "#7ea9d5"',
      'favicon: /assets/img/mine.svg',
      'apple_touch_icon: /assets/img/mine.png',
      'analytics_html: \'<script src="https://x.example/a.js"></script>\'',
      ''
    ].join('\n'),
    homePosts: POSTS,
    problems: [
      'accent_dark is no longer a setting',
      'favicon is no longer a setting',
      'apple_touch_icon is no longer a setting',
      'analytics_html is no longer a setting'
    ]
  },
  {
    // Values that are valid CSS where a colour goes, and are not colours. Both
    // gates passed these and the links rendered in body ink or vanished.
    name: 'a CSS keyword instead of a colour',
    config: 'accent: transparent\n',
    homePosts: POSTS,
    problems: ['which is a CSS keyword rather than a color'],
    expect: (home) => {
      assert.doesNotMatch(home, /<style>/, 'a non-colour must not reach the stylesheet at all');
    }
  },
  {
    name: 'an accent you can see through',
    config: 'accent: "rgb(200 0 0 / 20%)"\n',
    homePosts: POSTS,
    problems: ['accent has transparency in it']
  },
  {
    name: 'an accent that points at something else',
    config: 'accent: "var(--brand)"\n',
    homePosts: POSTS,
    problems: ['points at another custom property']
  },
  {
    name: 'a feed length that is not a length',
    config: 'feed:\n  posts_limit: -2\n',
    homePosts: POSTS,
    problems: ['feed.posts_limit is -2']
  },
  {
    // YAML turns six bare words into booleans before anything here runs, and one
    // of them is the language code for Norwegian. `lang: no` was producing
    // <html lang="false"> with nothing reported; `title: on` rendered the site
    // name as "true"; `author.name: yes` printed "© 2026 true".
    name: 'bare words YAML reads as true or false',
    config: 'lang: no\ntitle: on\ntagline: off\nauthor:\n  name: yes\n',
    homePosts: POSTS,
    problems: [
      'lang was read as a true/false value',
      'the language code for Norwegian has to be written lang: "no"',
      'title was read as a true/false value',
      'tagline was read as a true/false value',
      'author.name was read as a true/false value'
    ],
    expect: (home) => {
      assert.match(home, /<html lang="en" dir="ltr">/,
        'a boolean language must fall back, not become lang="false"');
      assert.match(home, /class="wordmark"[^>]*>home</,
        'a boolean title must fall back, not render as "true"');
      assert.doesNotMatch(home, /© \d+ true/, 'a boolean author must not be credited as "true"');
    }
  },
  {
    // Both of these parse cleanly and make site.footer.github unreadable, so
    // every footer link vanished silently.
    name: 'footer written flat instead of nested',
    config: 'footer: octocat\n',
    homePosts: POSTS,
    problems: ['footer is set but has no github or email under it']
  },
  {
    // The one class the templates cannot fully contain, recorded as a test rather than
    // as a footnote. jekyll-seo-tag prints site.lang straight into a meta tag without
    // escaping it, so a quote there escapes the attribute no matter what the layouts
    // do. quiet still renders correctly and still says what is wrong — and the output
    // check refuses to pass the build, which is the right answer for a value that has
    // to be corrected rather than tolerated. If a future jekyll-feed/seo-tag release
    // escapes it, this case starts failing and the workaround can come out.
    name: 'a quote in lang, which jekyll-seo-tag prints unescaped',
    config: 'lang: \'en" onload="alert(1)\'\n',
    homePosts: POSTS,
    problems: ['which is not a language code', 'jekyll-seo-tag reads this setting straight from your config'],
    expectOutputRejected: true,
    expect: (home) => {
      assert.match(home, /<html lang="en" dir="ltr">/,
        'the document language itself must still be the validated fallback');
    }
  },
  {
    // The other half of the guarantee: a valid config must report nothing. A validator
    // that rejects `oklch(52% 0.1 250)` — the value the config file itself suggests —
    // would be worse than no validator, and this is how that regression gets caught.
    name: 'unusual but valid values are left alone',
    config: [
      'accent: "oklch(52% 0.14 30)"',
      'lang: en-GB',
      'body_font: serif',
      'theme_default: dark',
      'posts_on_home: all',
      'show_credit: false',
      'date_format: "%Y-%m-%d"',
      'footer:',
      '  github: "octocat"',
      '  email: "a.b+c@example.co.uk"',
      ''
    ].join('\n'),
    homePosts: POSTS,
    problems: [],
    expect: (home) => {
      assert.match(home, /--accent:oklch\(52% 0\.14 30\)/, 'a valid oklch accent must reach the stylesheet');
      // The dark-mode accent is derived, not configured. Reusing the light value
      // measured below 4.5:1 on the dark background for every hue tested.
      assert.match(home, /--accent:oklch\(from oklch\(52% 0\.14 30\) 0\.72 calc\(c \* 0\.8\) h\)/,
        'the dark accent must be derived from the light one');
      assert.match(home, /--accent:oklch\(from oklch\(52% 0\.14 30\) clamp\(0\.3, l, 0\.5\) c h\)/,
        'the light accent must be bounded too, or one of the two themes is left to chance');
      assert.match(home, /@supports \(color:oklch\(from /,
        'the derivation must be guarded, so a browser without relative color keeps the light accent');
      assert.match(home, /<html lang="en-gb" dir="ltr" data-theme="dark">/, 'valid lang and theme must be applied');
      assert.match(home, /<body class="font-serif">/, 'a valid body_font must be applied');
      assert.match(home, /<a href="https:\/\/github\.com\/octocat" rel="me">/,
        'a valid username must produce a link, carrying rel="me" so the profile can verify it back');
      assert.doesNotMatch(home, /built with/, 'show_credit: false must remove the credit');
    }
  }
];

function build(name, config) {
  // Beside the source, not inside it. A .yml left in the source tree is a file
  // Jekyll publishes — which /site-check/ now correctly reports, and which this
  // harness was quietly creating on every run.
  const configPath = path.join(temporary, `hostile-${name}.yml`);
  fs.writeFileSync(configPath, config);
  const destination = path.join(temporary, `out-${name}`);
  jekyllBuild({
    source,
    destination,
    config: [path.join(source, '_config.yml'), configPath],
    cwd: BUNDLE_CWD
  });
  return destination;
}

try {
  fs.cpSync(ROOT, source, {
    recursive: true,
    filter: (file) => {
      const first = path.relative(ROOT, file).split(path.sep)[0];
      return !new Set(['.git', '.bundle', '.jekyll-cache', '_site', '_site-subpath',
        '_site-test', 'node_modules', 'vendor']).has(first);
    }
  });

  const posts = path.join(source, '_posts');
  fs.rmSync(posts, { recursive: true, force: true });
  fs.mkdirSync(posts, { recursive: true });
  for (let index = 1; index <= POSTS; index += 1) {
    fs.writeFileSync(path.join(posts, `2026-01-0${index}-post-${index}.md`),
      `---\ntitle: post ${index}\ndescription: ""\n---\n\nBody ${index}.\n`);
  }

  // Two titles that reduce to the same slug in the same year resolve to one permalink:
  // the home page lists both, both links land on the same page, and one post is simply
  // gone. Jekyll says nothing about it, so the site check has to.
  // `permalink: /:year/:title/` takes :title from the filename slug, so these two
  // different filenames — what `blog:new "Hello World"` and `blog:new "Hello, World!"`
  // produce in the same year — resolve to the same address.
  fs.writeFileSync(path.join(posts, '2026-02-01-hello-world.md'),
    '---\ntitle: Hello World\ndescription: ""\n---\n\nFirst.\n');
  fs.writeFileSync(path.join(posts, '2026-03-01-hello-world.md'),
    '---\ntitle: "Hello, World!"\ndescription: ""\n---\n\nSecond.\n');
  // And two more silent ones: a date Ruby will read differently than it was written,
  // and `draft: true`, which reads like "hide this" and only hides it from the feed.
  fs.writeFileSync(path.join(posts, '2026-04-01-us-dated.md'),
    '---\ntitle: us dated\ndescription: ""\nlast_modified_at: 03/04/2026\n---\n\nBody.\n');
  fs.writeFileSync(path.join(posts, '2026-05-01-half-hidden.md'),
    '---\ntitle: half hidden\ndescription: ""\ndraft: true\n---\n\nBody.\n');
  const collided = build('post-problems', 'posts_on_home: 5\n');
  // Liquid conditionals leave newlines mid-sentence; HTML collapses them, so the
  // assertions read the text the way a browser does.
  const collisionReport = fs.readFileSync(path.join(collided, 'site-check', 'index.html'), 'utf8')
    .replace(/\s+/g, ' ');
  assert.match(collisionReport, /2 posts share the address <code>\/2026\/hello-world\/<\/code>/,
    'two posts resolving to one permalink must be named on the site check');
  assert.match(collisionReport, /Hello, World!/, 'the colliding titles must be named');
  assert.match(collisionReport, /<em>us dated<\/em> has a <code>last_modified_at<\/code>/,
    'a date that is not YYYY-MM-DD must be named, since Ruby guesses at it');
  assert.match(collisionReport, /<code>draft: true<\/code>, which only hides it from the feed/,
    'draft: true must be reported as the half-measure it is');
  assert.match(collisionReport, /<code>published: false<\/code>/,
    'the report must name the setting that actually hides a post');
  for (const name of ['2026-02-01-hello-world.md', '2026-03-01-hello-world.md',
    '2026-04-01-us-dated.md', '2026-05-01-half-hidden.md']) {
    fs.rmSync(path.join(posts, name));
  }

  for (const testCase of CASES) {
    const slug = testCase.name.replace(/[^a-z]+/gi, '-').toLowerCase();
    let destination;
    try {
      destination = build(slug, testCase.config);
    } catch (error) {
      const output = `${error.stdout || ''}${error.stderr || ''}`;
      assert.fail(`"${testCase.name}" failed to build. A bad setting must never stop the ` +
        `site from being published:\n${output.split('\n').slice(-12).join('\n')}`);
    }

    const home = fs.readFileSync(path.join(destination, 'index.html'), 'utf8');
    const report = fs.readFileSync(path.join(destination, 'site-check', 'index.html'), 'utf8');

    // The page is still a page.
    const title = home.match(/<title>([\s\S]*?)<\/title>/);
    assert.ok(title && title[1].trim() !== '',
      `"${testCase.name}": the page lost its <title>, so it has no name in a tab, a ` +
      'bookmark, a search result, or to a screen reader');
    assert.match(home, /<html lang="[a-z0-9-]+" dir="(?:ltr|rtl)"/,
      `"${testCase.name}": the document language or writing direction is malformed`);
    assert.match(home, /<body class="font-(?:sans|serif)">/,
      `"${testCase.name}": the body class was rewritten by a config value`);
    assert.equal((home.match(/<a class="post-list-title"/g) || []).length, testCase.homePosts,
      `"${testCase.name}": wrong number of posts on the home page`);
    assert.match(home, /class="wordmark"[^>]*>[^<]+</,
      `"${testCase.name}": the header link home has no visible text`);

    // Every problem was reported, in words, on the page an author can actually open.
    // The report is HTML; its text is escaped. Compare what a reader sees.
    const decode = (text) => text
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    // These fixtures inherit the shipped placeholder identity, which now reports
    // itself on purpose. It is expected everywhere and is not what is under test.
    const reported = [...report.matchAll(/<ol class="config-problems">([\s\S]*?)<\/ol>/g)]
      .flatMap((list) => [...list[1].matchAll(/<li>([\s\S]*?)<\/li>/g)])
      .map((match) => decode(match[1].replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim())
      .filter((line) => !line.startsWith("Still set to the template's placeholder"));
    for (const fragment of testCase.problems) {
      assert.ok(reported.some((line) => line.includes(fragment)),
        `"${testCase.name}": nothing reported about "${fragment}".\nReported:\n  ` +
        (reported.join('\n  ') || '(nothing)'));
    }
    if (testCase.problems.length === 0) {
      assert.equal(reported.length, 0,
        `"${testCase.name}": a valid config was reported as a problem:\n  ${reported.join('\n  ')}`);
    }

    if (testCase.expect) testCase.expect(home);

    // And nothing escaped its attribute anywhere in the output.
    let outputRejected = false;
    let rejection = '';
    try {
      run('node', [path.join(source, 'tests/config-lint.cjs')], {
        env: { SITE_ROOT: destination, QUIET_ALLOW_CONFIG_PROBLEMS: '1' }
      });
    } catch (error) {
      outputRejected = true;
      rejection = `${error.stdout || ''}${error.stderr || ''}`
        .split('\n').find((line) => line.includes('AssertionError')) || '';
    }
    if (testCase.expectOutputRejected) {
      assert.ok(outputRejected,
        `"${testCase.name}": the output check passed, but this case exists because it ` +
        'should not. If the upstream plugin now escapes the value, delete the workaround ' +
        'and this expectation together.');
    } else {
      assert.ok(!outputRejected,
        `"${testCase.name}": a config value escaped into the output.\n  ${rejection}`);
    }
  }

  process.stdout.write(`PASS hostile config: ${CASES.length} configs plus colliding permalinks, ` +
    'site intact and every problem reported\n');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
