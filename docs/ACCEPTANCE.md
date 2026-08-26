# acceptance report — quiet 1.2 candidate

Updated 2026-08-25. This report separates retained checks from historical
point-in-time audits. A dated pass is evidence for that build, not a permanent
property of every fork or host.

The current toolchain is Ruby 3.3.12, Bundler 2.6.9, Jekyll 3.10.0, Node 22,
Playwright 1.62.1, and axe-core 4.13.0. Ruby, gems, and npm packages are pinned
in the repository; CI runs with Bundler frozen.

## retained release checks

| # | check | current evidence |
|---|---|---|
| 0 | **A bad setting cannot break the site, and says so** | `npm run test:hostile` builds fourteen configs — `posts_on_home` at 1000, −10, `abc`, 0, an empty value, a list, and `all`; an every-setting-hostile config carrying CSS-injection, attribute-injection, quoted booleans, an off-site favicon and unusable footer identities; and a valid-but-unusual config that must report nothing. Each asserts the page still has a title, a language, an unrewritten body class, a named home link, the right number of posts, and that every problem is named in words at `/site-check/`. It also covers the values YAML rewrites before any template sees them — `lang: no` (Norwegian, read as `false`), `title: on`, `author.name: yes` — and `footer:` written flat instead of nested, which parses cleanly and silently drops both footer links. And it builds two posts that resolve to one permalink, a `last_modified_at` Ruby would misread, and a `draft: true`, and asserts each is reported. `npm run doctor` reads that same report and exits non-zero, so CI fails on a dirty config without restating a single rule. |
| 1 | Generic template and production demo build from clean source | `npm run verify` validates the host-neutral build, `npm run verify:cloudflare` adds Cloudflare's output headers, and `npm run test:portable` simulates a customized fork with the demo posts and hjadmz overlay removed. `npm run verify:demo` additionally checks the exact demo routes, canonical origin, placeholder removal, and visible demo/AI disclosure. The build checks cover strict front matter, generated routes, local links/fragments, metadata, output exclusions, deployment headers, and budgets. |
| 2 | Generic and project-subpath builds remain portable | The default GitHub Pages config and a `/quiet` baseurl overlay both build and pass the same generated-site checks. |
| 3 | JavaScript is optional | A controlled post fixture keeps customization separate from the browser contract. Chromium, Firefox, and WebKit retain the article content, TOC, heading anchors, tables, and navigation with JS disabled. Theme and copy controls disappear rather than becoming dead UI. |
| 4 | Every route holds on every device, automatically | The browser matrix names **13 real devices** — folded Galaxy Z Fold (280px), small phone, iPhone SE, Pixel 8, unfolded Fold, iPhone in landscape, iPad both orientations, MacBook Air 13, Framework 13, 1080p, 1440p, and a 5120px ultrawide — and visits **every route on every one of them, in all three engines**: 65 device/route combinations per engine, 195 per run. Each asserts no document-level horizontal overflow, 44px header and footer targets, exactly one theme icon showing, and a contents list that is either absent or populated. The list is the promise: a sweep somebody performs by hand when prompted is a memory, not a guarantee. The narrowest, a mid-size phone, a tablet and the ultrawide additionally take the stress pass — unbreakable site titles, post titles, taglines and footer identities injected — and check that the measure caps rather than stretches: 627px on a MacBook and 627px on the 5120px display. Wide tables and code scroll inside focusable containers, and the reference post embeds a 1400px SVG, a 1280×720 video, a wide figure and a running demo so replaced content cannot regress. Runtime is about 45 seconds per engine. |
| 4c | Browser text size, which is not page zoom | Zoom scales pixel values along with text, so a layout can pass a zoom test and still break when someone raises only their default font size — the setting people with low vision actually use, and the one WCAG 1.4.4 is about. Every route is now checked at **16, 24, 32 and 48px default text on a 320px viewport**, asserting no document overflow, navigation still inside the viewport, and the copy button still clear of the first line of code. Three real defects were found this way and fixed: the header nav could not wrap (79px of overflow at 48px text), archive entries could not wrap, and the "elements allowed to break a long word" rule was an enumerated list of classes that had rotted — it was missing the archive's own heading and its descriptions, each of which scrolled the whole document sideways. That list is now one rule scoped to `main`, with code put back to `normal` because it scrolls in its own box. Chromium only: setting a browser's default font size is a CDP capability with no Playwright equivalent in the other two engines, which is stated rather than quietly skipped. |
| 4b | The layout holds in both writing directions | `dir` is derived from `lang`, and the CSS uses logical properties everywhere the physical one would pin content to the left. Measured with `dir="rtl"`: identical `main`, prose, list-indent and quote-rule geometry to LTR at all six widths, and zero horizontal overflow — against ~17,000px of RTL overflow beforehand, from one off-screen skip link. That measurement enumerated element types, and so missed one. A `wide` figure was positioned with physical `left: 50%` and `translateX(-50%)`, which assumes the box starts at the physical left; in RTL it landed 325px off the column and put **296px of horizontal scroll on every RTL page carrying one**. It is now expressed as symmetric negative margins — the same number on both sides, so there is no side to get wrong — and RTL and LTR geometry are byte-identical again, captions included, in all three engines. The lesson is recorded rather than quietly fixed: an enumerated check tests the cases somebody thought of, which is why the alignment check below is a property rather than a list. |
| 4d | **The page has one left margin, and the suite proves it** | Alignment is asserted on all 195 device/route/engine combinations rather than reviewed by eye. Three properties: the elements that sit on the column's own edges — wordmark, header links, first footer link, identity line — are on it exactly, with no tolerance; every other text block is either on the column, within one of at most four small declared indents (callout rule, quote rule, list marker), or flush to the far edge; and every `figcaption` begins exactly on the prose rail, since a caption is prose. The column's position is compared across routes too, because a page that scrolls and one that does not otherwise centre against different widths. Five defects were found this way, four of them shipping: a wide figure's caption 180px outside the column; the whole layout jumping 7.5px sideways between routes, mid cross-fade; the two links on the page's edges 2px off, from the padding that buys their hit area, including one that only misaligns once the header wraps; the RTL figure in 4b; and a 7px caption overhang at 280px, where `100vw` counts the reserved scrollbar — fixed structurally by letting only the media leave the column, so the caption is correct by construction instead of by correction. `assertNoOverflow` was strengthened in the same pass: reserving the scrollbar gutter makes `clientWidth` count the reserved strip, and a measured 7px overflow had begun reading as clean. |
| 4e | **Day one in a fork does not leave anything behind** | The first two things anyone does with a template are delete the demo posts and decide whether they want an `/about/` page. `npm run test:edge` now builds exactly that fork and asserts it: an empty site shows a real empty state on both the home page and the archive rather than a blank column, the feed stays valid Atom with zero entries, and **no page anywhere in the output links to a page that was deleted**. That last one was a live defect — the nav links were hardcoded, so removing `about.md` put a dead link in the header of every page while the build stayed green, and the README is right that a hosted fork never runs this suite, so the link checker could not be the answer. The header now links to a page only when that page is in the build, and `/site-check/` names the one that went, so the removal is neither broken nor silent. Verified to fail against the previous markup before being kept. One more leftover was found the same way and is now reported: the shipped `tagline` is quiet's own line, presented as the author's under their own name on the most-read page of the site, and the README's "change those four and stop" does not include it. It is flagged as a placeholder like `url` and `author.name`, with the same exemption for this repository's own builds. |
| 4f | **The template does not punish you for using it** | Found by Henry's own fork, not by this suite: `verify` passed `SITE_URL=https://username.github.io`, so the moment an author did step 2 of the quickstart — set your own `url` — their CI failed with *"generated home canonical uses https://theirsite, expected https://username.github.io"*. Every fork inherits `.github/workflows/quality.yml`, so the template shipped a red build to everyone who personalised it, on the one file the quickstart tells them to edit first. `site-smoke.cjs` had always fallen back to the site's own canonical when `SITE_URL` is unset; only the caller was wrong, and the fix is its removal. `verify:cloudflare` is now gated to this repository too — it carries the demo's origin and the README tells forks to delete the overlay it needs, so in a fork it either tested someone else's domain or failed on a deliberately-absent file. `npm run test:portable` builds a fork at `url: https://reader.example` and runs the full smoke suite against it, and additionally asserts that no script a fork runs pins a literal origin — the build alone could not catch it, because it invokes the harnesses directly rather than through npm. Verified to fail against the previous `package.json` before being kept. |
| 4g | **The theme icons share one optical centre** | Henry looked at the three states side by side and asked whether they were centred. The boxes were — within 0.7px of the word's cap-height in all three engines — and the crescent still hung low, because centring a box is not centring a mark. Measured by rendering each icon at 8× and taking the centroid of its ink coverage: sun +0.09px, half-circle +0.08px, **crescent +1.15px**. A crescent's mass sits in its lower bulge, so a centred box puts the visible shape below the word. The path is now lifted 1.7 units in the 24-unit box, which brings it to −0.02px; the spread between the three went from **1.07px to 0.11px**, consistently in Chromium, Firefox and WebKit. The same measurement shows the half-circle carrying 34% ink coverage against 19–20% for the other two — it is the heaviest of the set because it is partly filled. That is left alone deliberately: the fill is what distinguishes "follow the system" from a state you chose, and it is the mark macOS and Android use for appearance. Geometry and the eye were both right; they were measuring different things. |
| 5 | Automated accessibility scan | axe-core 4.13 reports zero violations across the five controlled HTML routes in Chromium, Firefox, and WebKit. Production smoke checks separately cover all seven demo routes. This complements; it does not replace, keyboard and screen-reader review. |
| 6 | Skip navigation and keyboard flow | Activating “skip to content” focuses `main`; subsequent keyboard navigation bypasses the repeated header. TOC, heading permalinks, table/code scroll regions, theme, and copy controls are operable. Chromium and Firefox verify literal first-Tab order. WebKit verifies focus and activation without assuming macOS Keyboard Navigation; Safari's Option+Tab order remains a manual platform check. |
| 7 | Targets do not overlap | Header and footer controls are real 44px-high boxes at every tested width. The code-copy control is isolated and may extend its hit area without colliding with another control. |
| 8 | Reading measure and type | Desktop prose is 627px at 19px/30.4px. Representative body lines measure roughly 69–77 characters; the line that previously reached 87 now reaches 74. Body size remains 17–19px with 1.6 leading. |
| 9 | Contrast and preferences | Token calculations remain: body 16.4:1 light / 13.7:1 dark; muted 6.7 / 6.9; accent 5.2 / 7.5. axe checks rendered contrast. Reduced-motion, increased-contrast, forced-colors, light, dark, and system styles are present; the three-state preference persists and rejects invalid stored values. |
| 10 | Build-time content plumbing | Attributed headings retain custom ids/classes in the contents list and permalinks. Attributed tables retain their attributes inside a focusable scroll container — focusable, but deliberately not a landmark, since `replace` cannot count and every table was being given the same landmark name. That container now actually scrolls: a wide table measures 1,077px inside a 338px column, where before it was silently squeezed to fit and the scroll box never engaged. Empty descriptions do not leave separators; image-only posts still show a one-minute minimum. |
| 11 | Feed, sitemap, and metadata | The source feed template stays byte-for-byte aligned with jekyll-feed 0.17 except for two targeted role removals; the plugin still provides discovery metadata and deliberately skips the existing feed path. Strict XML checks cover full entry content, timestamps, authors, canonical/self/footer links, subpaths, footnote targets, and sitemap exclusion. jekyll-sitemap generates the sitemap. `last_modified_at` feeds visible and machine-readable update metadata. |
| 12 | Images and print | The demo image loads at its declared 1200×675 intrinsic size. Print hides site chrome, theme, copy, TOC, and adjacent-post navigation and returns to black on white. |
| 13 | Runtime budget | Two budgets per asset, because they answer different questions. The **transfer** budget is what a reader waits for — every stylesheet and script in the output, gzipped: 9 KiB CSS, 2 KiB JS, 512 B for the inlined theme script. The **source** budget caps what the author writes: 28 KiB CSS, 4 KiB JS, 1 KiB theme. Both measure every emitted `.css`/`.js` file rather than a list of names that was true once. **This table is the only record of those numbers**; the suite prints live utilisation on PASS rather than repeating them in a comment, because they were previously copied into three places and no two agreed. |
| 13b | The budget has moved twice, on purpose | CSS went 20,498 B raw / 6,404 B gzipped → 24,438 / 7,908 → **26,831 / 8,708**, against budgets raised 24 KiB/8 KiB → 28/9 → **32/10**. The first move bought containment for embedded media (without it one `<video>` scrolled the whole document sideways at every width), logical properties for RTL, display-cutout handling, the `wide` escape hatch and the demo frame. The second bought the bounded accent, a table wrapper that actually scrolls, a themed `<mark>`, task lists with one marker instead of two, and the restyled contents list. Both are recorded here rather than edited quietly, which is the only thing that makes a budget a budget. The third move was utilisation, not budget: **28,037 / 9,142 → 29,099 / 9,577** inside the same 32 KiB/10 KiB, buying the alignment work in 4b and 4d. The first draft of those comments reached 99% of the gzipped budget, leaving a fork no room; two trimming passes gave back 1,498 B raw and 546 B gzipped while keeping every measured number. That is what the budget is for. |
| 13c | Comments are ~36% of the stylesheet, and that is a decision | Roughly 3.5 KB gzipped of the CSS is commentary, now spread evenly — the largest single comment is 440 B, so there is no fat left to trim, only reasoning. A reader pays it **once**, since `_headers` serves CSS `immutable` for a year, and a template meant to be forked and edited by hand is worth that once. The essays that had outgrown a comment already moved to `docs/DESIGN-PRINCIPLES.md` with one-line pointers in the CSS. Deleting explanations to hit a number would have been the wrong trade, so the number moved instead — visibly. |
| 15b | Read-aloud tools can read it | Firefox's reader view (Readability, the extractor behind Safari Reader and most read-aloud features) is run over the reference post. Asserted: more than 60% of the rendered article survives extraction, compared as a fraction so it does not rot as the fixture grows; the title and every heading come through; heading permalinks and the table of contents do not, since both are read aloud as noise; code blocks survive; and a demo's caption survives although the demo cannot. This is the evidence for refusing to ship a play button. |
| 16 | The suite runs where the template claims to | CI runs the whole suite on Ubuntu, macOS and Windows. Three things differ per machine and each had already broken something: file-name case is significant on Linux and not on macOS or Windows (the link checker now compares real directory entries, so a link to `/Archive/` fails locally instead of 404ing in production); `bundle` is a batch file on Windows and could not be spawned without a shell; and Ruby's default encoding follows the locale, so the feed checks crashed on any machine whose locale was not UTF-8 — masked in CI by an exported `LANG`. The Bundler version is no longer pinned inside the harnesses, so a fork can run the commands the README documents. **That claim went untested until the first push, and Windows failed immediately** — proof that a CI file is not evidence until it has run. `Gemfile.lock` carried no Windows platform, so `bundle install` refused before a single test ran (`exit code 16`, `your local platform is x64-mingw-ucrt`); `x64-mingw-ucrt` and `x64-mingw32` are now locked. Behind it sat a second failure the first one hid: `timezone:` is set in `_config.yml`, Windows ships no zoneinfo database, and `tzinfo-data` was absent, so Jekyll would have failed the build outright. It is now a Windows-only dependency, gated with Bundler's `:windows` alias — `[:mingw, :x64_mingw, :mswin]` names DEPENDENCIES but never resolves a spec, which looks fixed and is not. No gem version moved. A Windows fork would have hit both locally, not only in CI. Past those, Windows reached the third: `VAR=value command` is POSIX syntax that `cmd.exe` rejects outright (`'QUIET_EXPECT_PLACEHOLDER' is not recognized`), and five scripts used it — so `npm run verify` could never have run on a Windows fork. `cross-env` now prefixes the eleven affected segments. It is the one added dependency in this pass and it is `devDependencies` only: a fork that publishes on GitHub Pages never installs npm at all, so no reader pays for it. Each of these three sat behind the one before it, which is the argument for running a matrix rather than declaring one. |
| 17 | Deviations from the vendored feed are declared, not diffed | `tests/feed-smoke.rb` strips explanatory comments, then reconstructs the expected file by applying six named transforms to the installed jekyll-feed. An upgrade that removes an anchor fails naming the deviation that stopped applying; a genuine drift fails with the first differing line, ours and expected. The version is read from the installed gem rather than pinned to 0.17.0. |

## deliberate limits

Recorded because they are known, not because they are acceptable in every fork:

**What a person editing `_config.yml`, front matter or a post cannot break** —
every one of these was attempted against the built site and is either corrected
or reported at `/site-check/`: any value for `posts_on_home`; any accent,
including CSS keywords, `var()`, transparency, a bare hex missing its `#`, and
colours that would fail contrast in either theme; the YAML booleans `no`/`yes`/
`on`/`off` in `title`, `tagline`, `description`, `lang` and `timezone`, which is
where Norwegian used to become `lang="false"`; a language name where a code
belongs; `footer:` written flat or as a list; quoted booleans; a title of nothing
but zero-width characters; two posts colliding on one address; a post whose
`permalink` claims `/`, `/about/`, `/feed.xml` or this page; a `last_modified_at`
Ruby would read the other way round; `draft: true`; retired keys; and — via
`npm run doctor`, since Jekyll never shows them to a template — a post with no
date in its filename, or one dated in the future.

**What it cannot catch, and why:**

- **A `#` in an unquoted value truncates it silently.** `tagline: C# notes`
  becomes `C`. The parser removes the rest before any template runs, so there is
  nothing left to detect. Prevented, not caught: the config file leads with the
  rule that fixes it, and every example value that could contain one is shown
  quoted.
- **A colon-space, a tab, an `@`, or an apostrophe inside single quotes stops the
  build.** These are YAML syntax errors. The message names the file and the
  position, though the apostrophe case can point at a line above the real one.
  This is the correct failure — a config that cannot be parsed cannot be guessed
  at — but it is a failure, not a fallback, and on GitHub Pages it arrives as an
  email rather than a page.
- **Duplicate keys silently take the last one.** That is YAML's rule, and by the
  time a template runs the first value no longer exists.
- **Two values crash a plugin rather than falling back:** `title: no` (in
  jekyll-github-metadata) and `lang: yes` (in jekyll-seo-tag), because both read
  the raw config before any of this code does. Neither is a plausible value, and
  both fail loudly rather than shipping something wrong.
- **Liquid runs inside post bodies.** `{{ … }}` in prose is evaluated and
  disappears, and a Liquid tag inside a code fence is executed rather than shown.
  Writing about template syntax needs a raw block; the README says so.

- **`jekyll-seo-tag` prints `site.lang` and `site.author.name` unescaped** into
  meta tags. No template can prevent it. Both are validated for quiet's own
  output and reported at `/site-check/`, and `tests/config-lint.cjs` fails the
  build on any inline event handler anywhere in the output, which is the only
  way such a value can manifest. A GitHub Pages author with no toolchain gets
  the report but not the hard stop.
- **An unparseable `last_modified_at` stops the build**, in the plugins rather
  than in the layouts, with an error naming the layout. A shape check in the
  layout was tried and removed: the metadata plugins read the raw value either
  way, so it only made the visible date disagree with the feed. The ambiguous
  but parseable case (`03/04/2026`) is reported at `/site-check/`.
- **Reading time counts code at prose speed.** `number_of_words` runs after
  `strip_html`, which removes Rouge's markup but keeps the code text, so a
  code-heavy post reads long. There is no clean pure-Liquid fix; it is
  documented as an approximation rather than corrected.
- **An explicit heading id that collides with an auto-generated one** ships a
  duplicate id and a table-of-contents link to the wrong heading. kramdown owns
  id generation and axe 4.x no longer flags duplicate ids, but the generated-site
  check does, so `npm run verify` catches it and a plain GitHub Pages build
  does not.
- **A heading kramdown cannot slug** (an image-only heading, for instance) is
  omitted from the table of contents without a warning.

## evidence boundary

The 2026-08-19 v1.0 audit recorded Lighthouse 100/100/100/100 and zero CLS
for its then-current build. Those numbers were not rerun for 1.1 and are not
presented as current acceptance evidence. The retained suite now supplies the
repeatable route, accessibility, browser, interaction, responsive, source,
and budget checks that were previously only described in prose.

The source build makes no third-party runtime request. Hosting can change that,
and this repository is a template rather than a deployment: nothing here is
served anywhere, so there is no hosted build to hold to that claim. The
`quiet.hjadmz.com` demo the earlier revisions of this report referred to is
retired, and `_config.cloudflare.yml` now carries a reserved example origin and
no identity. Anyone deploying from this template — including a demo fork of it —
should prove on their own preview:

1. deployment trigger is `github:push` for the exact reviewed commit;
2. Ruby is 3.3.12, Bundler is frozen, and the build runs `npm run
   verify:cloudflare` (a demo fork adds `EXPECT_DEMO=1`);
3. `_headers` is active, HTML includes `no-transform`, and CSS/JS return one
   unambiguous immutable cache policy;
4. no Bot Fight Mode/Javascript Detection bootstrap, `/cdn-cgi/` request,
   hidden challenge iframe, or `cf_clearance` cookie is injected;
5. canonical metadata matches the deployed origin, routes return the intended
   statuses, and the custom domain/TLS/DNS stay active.

## deliberate deviations

- The visible home title is the header wordmark; the structural h1 remains for
  assistive technology without repeating the same words on screen.
- The theme preference lives in the footer. It matters, but it is not a
  reading destination and should not shift or crowd primary navigation.
- Hex fallbacks accompany OKLCH tokens so older browsers receive a complete
  palette rather than a broken one.
- The heading permalink is `aria-hidden`. An accessible name on a descendant is
  folded into its ancestor's name, so a labelled anchor made every heading
  announce itself twice — measured in Chromium's accessibility tree as "A table
  permalink to A table" — which doubles the length of the one thing screen
  reader users navigate an article by. It is a pointer affordance; the heading's
  id gives everyone else the same URL.
- The theme control carries no `aria-live`. Its label is its accessible name, so
  a change is announced on activation by the ordinary mechanism, while a live
  region also fired on every page load for anyone who had ever set a theme.
- The table wrapper is focusable but is not a landmark. Liquid `replace` cannot
  count, so every table received the same landmark name; two tables in one post
  produced two indistinguishable rotor entries and a real axe violation.
- Reading time uses a 220-WPM estimate, rounded up with a one-minute minimum;
  it never displays zero.
- The archive date column omits the year because the year already labels each
  group.
- README screenshots stay under `docs/`, which is excluded from production.
