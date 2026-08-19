---
title: everything a post can do
description: every element this template styles, on one page — a reference for writers and a regression test for tinkerers.
toc: true
updated: 2026-08-18
---

This post exercises every element the template knows how to render.
Keep it around as a reference while writing, or delete it with the other
demo posts when you're ready.

## Text

Body text is set on a fluid scale — 17px on phones easing to 19px on
large screens — with a measure of about 66 characters, which is where
long-form reading is most comfortable. Links are [always underlined](#text),
emphasis comes in *italic* and **bold**, and inline code looks like
`const reader = "first"`.

Straight quotes become "smart" quotes automatically, dashes work — like
this — and footnotes land at the bottom of the page with a way back.[^1]

[^1]: And here it is. The return arrow takes you back to exactly where
    you left off, and the target is highlighted so the jump is never
    disorienting.

### Headings get anchors

Hover any heading (or focus it with the keyboard) and a quiet `#`
appears — a shareable deep link to that section, generated at build
time with no JavaScript.

#### Down to level four

Level-four headings share the body size and rely on weight alone.
Deeper nesting than this is usually a sign the post wants to be two posts.

## Lists

An unordered list:

- everything it needs
- nothing it doesn't
- set in type that gets out of the way

And an ordered one:

1. function — does it work?
2. convenience — does it remove friction?
3. aesthetics — does it create a meaningful experience?

## A table

Tables get minimal horizontal rules and tabular figures, and scroll
sideways on small screens instead of breaking the page.

| year | posts | words   | longest read |
|------|------:|--------:|-------------:|
| 2024 |    12 |  14,320 |       11 min |
| 2025 |    18 |  22,847 |        9 min |
| 2026 |     7 |   9,105 |       14 min |

## Code

Three languages, one restrained palette per theme. Every block gets a
copy button (keyboard-operable, announces "copied") — unless JavaScript
is off, in which case the button simply doesn't exist.

```js
// counts words the way the reading-time meta line does
function readingTime(text, wpm = 220) {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / wpm));
}
```

```css
/* the entire theming system is custom properties */
:root {
  --bg: oklch(98% 0.004 85);
  --fg: oklch(22% 0.005 85);
  --accent: oklch(52% 0.1 250);
}
```

```bash
# preview locally without installing anything (see README for Codespaces)
bundle exec jekyll serve --livereload
```

## An image, with a caption

Images declare their dimensions so the page never shifts while loading,
and lazy-load below the fold.

<figure>
  <img src="{{ '/assets/img/demo-figure.png' | relative_url }}"
       alt="A simple compositional study: a small dark square resting on a warm off-white field, positioned slightly above center."
       width="1200" height="675" loading="lazy">
  <figcaption>The pattern to copy: a figure, real alt text, explicit dimensions, a caption.</figcaption>
</figure>

## A quote

> Good design is as little design as possible. Less, but better — because
> it concentrates on the essential aspects, and the products are not
> burdened with non-essentials.

A horizontal rule, for when a section break is quieter than a heading:

---

That's everything. If it isn't on this page, the template doesn't style
it — and that's on purpose.[^2]

[^2]: If you add elements of your own, this page is also your visual
    regression test: one glance tells you if something broke.
