# quiet

A reading-first Jekyll blog template for GitHub Pages and static hosts.
[See the live demo](https://quiet.hjadmz.com).

**The philosophy in three sentences.** Function first, then convenience,
then aesthetics. The reader outranks the writer, and the writer outranks
the customizer. If the interface pulls attention away from reading, it has
failed; if its details make reading feel effortless, it has succeeded.

| light | dark |
|-------|------|
| ![The home page in light mode: a small wordmark, a one-line bio, and a clean list of posts on a warm off-white background.](docs/screenshot-light.png) | ![The same home page in dark mode: soft off-white text on an elevated near-black background.](docs/screenshot-dark.png) |

## quickstart

1. Click **Use this template** and name the new repo `username.github.io`,
   using your GitHub username. If you fork instead, rename the fork afterward.
2. In the repo settings, under **Pages**, make sure the source is
   "Deploy from a branch" with the `main` branch selected and `/ (root)`
   as the publishing folder.
3. Edit `_config.yml`. It opens with four settings under "Make it yours" —
   `title`, `author.name`, `url`, `baseurl` — and everything below them already
   works. Change those four and stop.
4. Delete the demo posts in `_posts/`, and rewrite `about.md`
    in your own words.
5. Write Markdown files in `_posts/` named `YYYY-MM-DD-your-title.md`.

You can skip manual file naming with:

```bash
npm run blog:new -- "My post title"
```

GitHub Pages rebuilds after each push to `main`; the exact wait varies.
The hosted path requires no local build tools. Local preview and the
maintainer checks use the pinned Ruby and Node dependencies in this repo.

### when something looks wrong

Open **`/site-check/`** on your own site — `https://yoursite.com/site-check/`.
Running `npm run dev` locally, you do not have to remember it: a problem puts a
line in the footer of every page, which never appears on the published site.

It is generated from your config and your posts on every build, and it says in
plain sentences what quiet could not use as written and what it did instead: a
setting that fell back to a default, two posts that resolved to the same
address, a date that will be read differently than you wrote it. A clean config
gets a clean page.

Nothing links to it, it is excluded from the sitemap, and it is marked
`noindex`, so readers will not find it. Delete `site-check.html` if you would
rather it did not exist.

One rule prevents most config mistakes before they happen: **when in doubt, put
quotes around the value.** YAML reads the bare words `no`, `yes`, `on` and `off`
as true and false — which is why Norwegian has to be `lang: "no"` — a `#` starts
a comment mid-line, and a colon-space stops the build. Quotes fix all three, and
never hurt a value that did not need them.

The rule behind the page: **a mistake in `_config.yml` changes what that page
says, never whether your site works.** Every setting is validated at build time, and
an unusable value is replaced by a documented default rather than being passed
through to break a page. If you have the toolchain, `npm run doctor` prints the
same report in a terminal and exits non-zero, so CI can fail on it.

## writing posts

Create a new post file with `npm run blog:new -- "My first post"` and then edit it:

```markdown
---
title: my first post
description: one honest sentence about what this post is.
---

Text goes here. Markdown in, blog out.
```

Front matter reference:

| key           | required | effect |
|---------------|----------|--------|
| `title`       | yes      | the post's title |
| `description` | by convention | one line under the title on the home page **and in the archive**, and the post's search/social description |
| `toc`         | no       | `toc: true` renders a table of contents from the post's h2 headings |
| `last_modified_at` | no  | `last_modified_at: 2026-09-01` shows an "updated" date and updates the feed, sitemap, and page metadata |
| `published`   | no       | `published: false` hides the post completely — no page, no feed, no sitemap |
| `image`       | no       | social-preview image for this post, overriding `assets/img/og-default.png` |
| `permalink`   | no       | a hand-written address for this post, instead of `/:year/:title/` |
| `tags`        | no       | listed as `<category>` entries in the feed; there are no tag pages ([why](docs/DESIGN-PRINCIPLES.md)) |

Write `description` for every post. It is the text the archive carries, and the
archive is what stands in for a search box — see
[finding things](#finding-things).

Two front-matter values are worth being careful with:

- **`last_modified_at` must be written as `2026-09-01`, unquoted.** Ruby parses
  `03/04/2026` as either the third of April or the fourth of March depending on
  nothing you can see, and a value it cannot parse at all stops the build. The
  ambiguous case is reported at `/site-check/`.
- **`draft: true` is not how you hide a post.** It only removes it from the
  feed; the page is still published, listed on the archive, and submitted to
  search engines. Use `published: false`, or keep the file in `_drafts/`. This
  is reported at `/site-check/` too.

Two ways a post can silently not exist: a filename with no `YYYY-MM-DD-` in
front of it is not a post at all, and a post dated in the future stays hidden
until a build happens on or after that day — nothing rebuilds a static site on a
schedule unless you set that up. Jekyll never shows either file to the template,
so `/site-check/` cannot report them; `npm run doctor` reads the folder directly
and does.

If you write **about** templates, wrap the examples in a raw block. Liquid runs
inside post bodies, so `{{ name }}` in prose is evaluated and vanishes, and a
Liquid tag inside a code fence is executed instead of shown.

Files in `_drafts/` (no date in the filename) are not rendered by a normal
build. They are still visible if committed to a public repository, so never
put secrets or genuinely private writing there. Preview them with
`npm run dev`.

### heading anchors and TOC behavior

`quiet` generates both TOC and heading anchors at build time from real rendered headings:

- `toc: true` builds a TOC from **h2 headings only**. A contents list answers
  "what shape is this post, and where do I jump in" — which h2s answer; h3s are
  subdivisions you meet inside a section, not destinations you pick from the top.
  Measured on a six-section post, including h3 gave 16 entries filling 87% of a
  phone's first screen; h2 alone gives 6 and leaves the opening paragraph
  visible. Use it when a post has five or more sections and readers will jump
  between them; leave it off for a linear essay.
- h2–h4 headings receive a small `#` permalink; it lets readers link to a
  specific section. It is hidden from screen readers on purpose — an accessible
  name inside a heading gets folded into the heading's own name, which made
  every heading announce itself twice.
- No JavaScript is used for these links; they are part of the generated HTML.
- If you want a cleaner look, remove heading hashes by changing `.anchor` in `assets/css/main.css` (for example, `display: none;` or a neutral color).

Deep h4 headings stay out of the TOC to avoid an overly busy map.

### images, video, and running demos

The reading column is 36rem, which is right for text and wrong for a
screenshot. `class="wide"` on a figure opts out of the measure, up to 52rem:

```html
<figure class="wide">
  <img src="/assets/img/wide-shot.png" alt="…" width="1600" height="900">
  <figcaption>A figure wider than the text.</figcaption>
</figure>
```

Video is self-hosted only — no YouTube or Vimeo embeds, which mean third-party
tracking and roughly a megabyte of player JavaScript. Put an `.mp4` in
`assets/`, give it a `poster` so it renders something with JavaScript off, and
add `<track kind="captions">`. GitHub caps files at 100 MB, so keep it short;
past a minute or so, link out instead.

**Interactive demos** are the one thing here that is not just prose. Write an
ordinary HTML file — whole document, its own CSS and script — under
`_includes/demos/`, then put one line in the post:

```liquid
{% include demo.html src="demos/hue-mixer.html" title="Hue mixer"
   height="220" caption="Drag to change the swatch." %}
```

`_includes/demos/hue-mixer.html` ships as a working example. The file is inlined
into the page at build time, so the demo makes **no network request of its
own**, and it runs in an iframe sandboxed without `allow-same-origin`: it has an
opaque origin, cannot read the page, its cookies, or its storage, and nothing it
does can reach the site around it. Storage and cookies are unavailable inside a
demo by design — keep state in a variable.

With JavaScript off the frame still renders the demo's static starting state, so
write a starting state that means something, and let the caption explain the
rest. Add `wide=true` to the include for a demo that needs more room.

Two consequences of that isolation worth knowing. A demo cannot see the site's
theme toggle, so it follows the reader's system setting — give it
`color-scheme: light dark` and it reads well either way. And `height` is fixed,
because an iframe cannot size itself to its content without script on both
sides; leave headroom, so a reader with larger text gets slack rather than a
frame that scrolls inside itself.

## finding things

There is no search box. The archive is the search box: it lists every post with
its date **and its description** on one page, so `Cmd/Ctrl+F` searches all of it
at once. A client-side index would need JavaScript and reimplement a control the
reader already owns; a hosted one would be a third-party request on every page.

**There is no limit on how many posts you can have**, and nothing is ever hidden
or deleted to make room. Measured on a 500-post site: it builds in 6.4 seconds,
the archive lists all 500, and it loads in 48 ms on a phone with no horizontal
overflow. `posts_on_home` only decides how many the *front page* shows.

What does change with scale is how comfortable that one long page is. At 53
posts the archive is about 5.7 desktop screens; at 500 it is 62 phone screens
and 158 KB (13 KB gzipped) — still one find-in-page scope, still fast, but long.
Somewhere around 75–100 posts it stops being scannable in one pass, and that is
the point to remeasure this decision rather than inherit it. Nothing in the code
prevents adding tag pages later; the archive is a choice, not a ceiling.

For the same reason there is no share button — the URL bar is one, and heading
permalinks let a reader share a specific section.

There is no comment box, no like button and no reaction bar either — all of them
need a server, which on a static host means someone else's. What replaces them is
the thing that predates them: set `footer.email` and a line appears under every
post offering a reply, with the post's title already in the subject.

There is also no built-in read-aloud. Anyone who listens has already picked a
voice and a speed in Safari's Listen to Page, Edge Read Aloud, Android
Select-to-Speak or a screen reader, and a play button on one blog cannot beat a
tool they have configured everywhere. Deferring is only respectful if those tools
work here, so `npm run test:compat` runs a post through Firefox's reader view —
the same Readability extractor behind Safari Reader — and fails if the article,
its headings, its code or a demo's caption do not survive, or if the heading
permalinks and the table of contents *do* (both get read aloud as noise).

[docs/DESIGN-PRINCIPLES.md](docs/DESIGN-PRINCIPLES.md) records each refusal with
what it would have cost.

## customization

Site-wide settings live in `_config.yml`, and every user-facing setting is
explained in place, including what happens when a value cannot be used. Posts,
the About page, and image files remain ordinary content. The short version:

| key | effect | if it is wrong |
|-----|--------|----------------|
| **`title`** | site name in the header, tab and feed | empty becomes "home" |
| **`author.name`** | feed, copyright line, metadata | reported; avoid quotes and `<>` |
| **`url`** | your address — canonical links, feed, sitemap | reported |
| **`baseurl`** | `/repo-name` for a project site, else empty | reported |
| `tagline`, `description` | one line on the page, one line for search results | — |
| `accent` | the one accent colour; both themes bound their own lightness | ignored; built-in accent stays |
| `body_font` | `sans` or `serif` — both system stacks | falls back to `sans` |
| `theme_default` | `system`, `light`, or `dark` | falls back to `system` |
| `posts_on_home` | how many the **home page** lists; 1–20, or `all`. Not a cap on how many posts you can have — there is none | falls back to 5, or clamps |
| `date_format` | `long`, `short`, `iso`, or a strftime string | falls back to `short` |
| `footer.github`, `footer.email` | footer links; the email is also the reply line under every post | an unusable value is left out, not linked |
| `show_reading_time`, `show_credit` | the "6 min read" meta and the footer credit | `"false"` in quotes is read as off, and reported |
| `lang` | html language code; RTL languages set `dir` too | falls back to `en` |
| `timezone` | IANA zone; `blog:new` reads it too | dates fall back to UTC |
| `feed.posts_limit` | how many posts the feed carries (default 10) | falls back to 10 |

Not settings, on purpose: the favicon, the apple-touch icon and the social image
are **files** — replace them in place at `assets/img/`. Analytics is **a file
too**: `_includes/analytics.html`, which explains what it costs before you add
anything. All three used to be config keys whose only power was moving a file;
if you have one in an old config, `/site-check/` says so and tells you what to
do instead.

Reading time counts every word, including the words inside code blocks, at
220 wpm. On a code-heavy post the estimate runs long; there is no clean way to
exclude code in Liquid, so it is a known approximation rather than a measurement.

### changing the accent

Set `accent` in `_config.yml` to any valid CSS color. Pick something with at
least 4.5:1 contrast against the light background (`#faf8f5`); dark mode works
out its own from the same value, keeping your hue and lifting the lightness.

That is one setting rather than two on purpose. The old default — reuse the
light accent in dark mode — is wrong for essentially every colour: measured
across 36 hues and chromas, all 36 landed below 4.5:1 on the dark background
(1.32:1 to 3.56:1). The derived value failed none of them (6.90:1 to 8.24:1). A
setting whose default is always wrong is a setting that quietly hands the work
back to you.

A value that is not a color cannot break the page. Characters that could
restructure a stylesheet are refused at build time, and the declaration is
wrapped in `@supports (color: …)` so the browser decides whether the rest is a
real color. A typo leaves the built-in accent and a line at `/site-check/`.
A browser too old for relative colour syntax skips the derivation and reuses the
light accent, which is what this template did before.

### changing the type

`body_font: serif` switches the body to a system serif stack (Charter /
Iowan Old Style / Georgia). Deeper changes live at the top of
`assets/css/main.css`: sizes, spacing, fonts, and radius in the first
`:root` block; colors in the OKLCH `@supports` blocks just below it
(the adjacent hex values are fallbacks for old browsers — keep them
in sync, once per theme).

## custom domain

This template intentionally ships without a `CNAME` file so forks do not
inherit someone else's domain accidentally.

For GitHub Pages, add a `CNAME` file containing your domain (for example,
`blog.example.com`), point DNS at GitHub Pages per
[GitHub's guide](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site),
and update `url` in `_config.yml`.

For Cloudflare Pages, connect the custom domain in the Pages dashboard;
do not add a GitHub Pages `CNAME` file. In either case, choose one canonical
hostname and set `url` to it.

## hosting somewhere else

The repository uses GitHub Pages' pinned Jekyll dependency set, but the
generated HTML, CSS, JavaScript, XML, and assets are host-independent:

- **Cloudflare Pages** — replace `_config.cloudflare.yml` with your own URL
  and identity; clear or rewrite its `description`, `demo_notice`, and footer,
  while keeping `include: ["_headers"]`. Connect the repo, set the
  production branch to `main`, build command to `npm run verify:cloudflare`,
  and output directory to `_site`. Set `RUBY_VERSION=3.3.12`,
  `JEKYLL_ENV=production`, and `BUNDLE_FROZEN=true` in production and previews.
- **Netlify or another static host** — run `npm run build` and publish
  `_site`. That generic build emits no host-specific response policy; add a
  host-native header configuration separately if you need one.
- **Any static host, or your own server** — run `bundle exec jekyll build`
  and upload the `_site` folder.
- **Served from a subfolder** (e.g. `example.com/blog`) — set
  `baseurl: "/blog"` and check it with `npm run test:subpath`. Template URLs
  use baseurl-aware filters, so no code changes are needed.

`_config.cloudflare.yml` contains only the settings for the public
`quiet.hjadmz.com` demo. A fork should delete it or replace it with its own
overlay; it is not loaded by a normal build.

## local preview

You usually don't need a local preview. When you want one:

- **Codespaces (no local install):** open the repo in a GitHub Codespace. The
  included devcontainer installs the Ruby and Node dependencies and starts the
  preview on port 4000 automatically.
- **Local:** use Ruby 3.3.12 and Node 22. Run `bundle install`, `npm ci`, and
  `npm run dev`. Open `http://localhost:4000`.

Before the first browser-matrix run on a machine or Codespace, install its
binaries once with `npx playwright install chromium firefox webkit` (on a
minimal Linux image, use `npx playwright install --with-deps`).

### checks

| command | what it proves |
|---------|----------------|
| `npm run doctor` | your `_config.yml` and posts are clean; exits non-zero if not |
| `npm run verify` | the site builds and the generated output holds up |
| `npm run test:hostile` | a broken config still produces a working site, and says what broke |
| `npm run test:portable` | a fork with the demo content deleted still passes |
| `npm run test:subpath` | the site works served from `/repo-name` |
| `npm run test:compat` | Chromium, Firefox, and WebKit, including no-JS, keyboard, print, responsive, and axe |

CI runs all of these, plus the Cloudflare overlay build, plus the whole suite on
macOS and Windows — because file-name case, `bundle` being a batch file, and the
default text encoding are all things that differ per machine, and a template
that claims to work everywhere should hold its own tests to that too.

Maintainers can regenerate the two README images from the current demo build
with `npm run docs:screenshots`.

## recipes

The template itself ships with zero third-party runtime requests—no fonts,
analytics, or trackers. Host-level security products can still inject code.
The Cloudflare overlay sends `no-transform`, which [Cloudflare documents](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/)
as disabling JavaScript Detections injection on matched responses. If you add
third-party services, reassess privacy and consent needs:

- **Analytics** — leave it off unless a concrete question justifies the
  collection. If it does, paste the provider snippet between the two marker
  comments in `_includes/analytics.html`, which explains the two ways that goes
  wrong before you do it. Generated-HTML checks allow external runtime between
  those markers explicitly. Anywhere else, external `src` URLs on script,
  iframe, img, source, video, and audio elements, plus external stylesheet,
  icon, and preload links, fail the build.
- **A custom font** — put the `.woff2` in `assets/`, add an
  `@font-face` rule at the top of `assets/css/main.css`, and change
  `--font-sans`. Self-host; never a font CDN.

## why it's built this way

Decisions follow an evidence hierarchy: accessibility requirements and
measured behavior first, the reading task second, and named design heuristics
only as lenses. Rams's principles, Benji Taylor's emphasis on simplicity and
continuity, Nielsen's heuristics, and familiar perception principles inform
the work; none is treated as automatic proof.
[docs/DESIGN-PRINCIPLES.md](docs/DESIGN-PRINCIPLES.md) records the
reasoning, sources, measured numbers, and refusals.
[docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) records the current retained test
matrix and separates automated evidence from older point-in-time audits.

## license

[MIT](LICENSE). Use it, change it, sell things built with it. The
"built with quiet" footer credit is one config key to remove —
guilt-free. The small feed-template derivation is covered in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
