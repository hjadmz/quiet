# quiet

A blog template for GitHub Pages. Everything it needs, nothing it doesn't.

**The philosophy in three sentences.** Function first, then convenience,
then aesthetics — never the other way around. The reader outranks the
writer, and the writer outranks the customizer. If you notice the design,
it has failed; if you read for twenty minutes without friction, it has
succeeded.

| light | dark |
|-------|------|
| ![The home page in light mode: a small wordmark, a one-line bio, and a clean list of posts on a warm off-white background.](docs/screenshot-light.png) | ![The same home page in dark mode: soft off-white text on an elevated near-black background.](docs/screenshot-dark.png) |

## quickstart

1. Click **Use this template** (or fork) and name the new repo
   `username.github.io`, using your GitHub username.
2. In the repo settings, under **Pages**, make sure the source is
   "Deploy from a branch" with the `main` branch selected (this is the
   default for `username.github.io` repos).
3. Edit `_config.yml` — every key is commented. Set at least `title`,
   `author.name`, and `url`.
4. Delete the three demo posts in `_posts/`, and rewrite `about.md`
   in your own words.
5. Write Markdown files in `_posts/` named `YYYY-MM-DD-your-title.md`.

Your site is live at `https://username.github.io` about a minute after
each push. No build tools, no dependencies, nothing to install.

## writing posts

Create `_posts/2026-08-18-my-first-post.md`:

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
| `description` | by convention | one line under the title on the home page, and the post's search/social description |
| `toc`         | no       | `toc: true` renders a table of contents from the post's h2/h3 headings |
| `last_modified_at` | no  | `last_modified_at: 2026-09-01` shows an "updated" date and updates the feed, sitemap, and page metadata |
| `image`       | no       | path to a social-preview image for this post, overriding the site default |

Drafts live in `_drafts/` (no date in the filename) and never publish.
Preview them locally with `bundle exec jekyll serve --drafts`.

## customization

Everything personalizable lives in `_config.yml`, and every key is
commented in place. The short version:

| key | effect |
|-----|--------|
| `title`, `tagline`, `description` | site name and one-line bio |
| `author.name` | feed and metadata attribution |
| `url`, `baseurl` | your address; `baseurl: /repo` for project sites |
| `lang` | html language code |
| `accent`, `accent_dark` | the one accent color (links, focus ring, selection) |
| `body_font` | `sans` or `serif` — both system stacks |
| `theme_default` | `system`, `light`, or `dark` |
| `posts_on_home` | how many posts the home page lists |
| `date_format` | strftime format for dates on posts and the home list |
| `timezone` | IANA timezone for post dates and feed timestamps |
| `show_reading_time` | the "· 6 min read" meta |
| `show_credit` | the "built with quiet" footer line |
| `footer.github`, `footer.email` | footer links; hidden when empty |
| `favicon`, `apple_touch_icon` | icon paths |
| `analytics_html` | empty by default; see recipes |

The default social-preview image is the file at
`assets/img/og-default.png` — replace it with your own (1200×630), or
point the `image:` path in the config's `defaults:` block somewhere else.

### changing the accent

Set `accent` in `_config.yml` to any CSS color. Pick something that
keeps at least 4.5:1 contrast against both backgrounds (`#faf8f5` light,
`#121416` dark), or set `accent_dark` for a separate dark-mode value —
lighter and slightly desaturated usually works.

### changing the type

`body_font: serif` switches the body to a system serif stack (Charter /
Iowan Old Style / Georgia). Deeper changes live at the top of
`assets/css/main.css`: sizes, spacing, fonts, and radius in the first
`:root` block; colors in the OKLCH `@supports` blocks just below it
(the adjacent hex values are fallbacks for old browsers — keep them
in sync, once per theme).

## custom domain

Add a `CNAME` file containing your domain (e.g. `blog.example.com`),
point your DNS at GitHub Pages per
[GitHub's guide](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site),
and update `url` in `_config.yml`.

## local preview

You usually don't need one — push and look. When you want one:

- **Codespaces (no install):** open the repo in a GitHub Codespace. The
  included devcontainer installs everything and starts the preview on
  port 4000 automatically.
- **Ruby, if you insist:** `bundle install`, then
  `bundle exec jekyll serve`, then open `http://localhost:4000`.

## recipes

The template ships with zero third-party requests — no fonts, no
analytics, no trackers, and therefore no cookie banner. If you need
more, add it deliberately:

- **Comments** — [giscus](https://giscus.app) (GitHub Discussions-backed).
  Generate your snippet and paste it at the end of `_layouts/post.html`.
- **Analytics** — [GoatCounter](https://www.goatcounter.com) or
  [Plausible](https://plausible.io) are privacy-respecting. Paste the
  script tag into `analytics_html` in `_config.yml`.
- **A custom font** — put the `.woff2` in `assets/`, add an
  `@font-face` rule at the top of `assets/css/main.css`, and change
  `--font-sans`. Self-host; never a font CDN.

## license

[MIT](LICENSE). Use it, change it, sell things built with it. The
"built with quiet" footer credit is one config key to remove —
guilt-free.
