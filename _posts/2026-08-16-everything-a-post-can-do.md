---
title: post-content reference
description: core post-content patterns on one page — a reference for writers and a regression test for tinkerers.
toc: true
last_modified_at: 2026-08-18
---

This post exercises the core supported elements inside a post's content.
Keep it around as a reference while writing, or delete it with the other
demo posts when you're ready.

## Text

Body text is set on a fluid scale — 17px on phones easing to 19px on
large screens — with a deliberately restrained reading measure. Links in prose are [underlined](#text),
emphasis comes in *italic* and **bold**, and inline code looks like
`const reader = "first"`.

Straight quotes become "smart" quotes automatically, dashes work — like
this — and footnotes land at the bottom of the page with a way back.[^1]

[^1]: And here it is. The return arrow takes you back to the reference,
    and the target highlight helps preserve orientation after the jump.

### Headings get anchors
{: #deep-links .reference-heading}

Hover an h2–h4 heading (or focus it with the keyboard) and a quiet `#`
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
{: .wide}

## Code

Three languages, one restrained palette per theme. Every fenced, highlighted
code block gets a copy button (keyboard-operable, announces "copied") — unless JavaScript
is off, in which case the button simply doesn't exist.

```js
// counts words the way the reading-time meta line does
function readingTime(text, wpm = 220) {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wpm));
}
```

```css
/* the screen palette is driven by custom properties */
:root {
  --bg: oklch(98% 0.004 85);
  --fg: oklch(22% 0.005 85);
  --accent: oklch(52% 0.1 250);
}
```

```bash
# in a prepared Codespace, or after the README's local setup
bundle exec jekyll serve --livereload
```

## An image, with a caption

This example declares dimensions to reserve layout space and requests lazy
loading below the fold; authors control both attributes in their markup.

<figure>
  <img src="{{ '/assets/img/demo-figure.png' | relative_url }}"
       alt="A simple compositional study: a small dark square resting on a warm off-white field, positioned slightly above center."
       width="1200" height="675" loading="lazy">
  <figcaption>The pattern to copy: a figure, real alt text, explicit dimensions, a caption.</figcaption>
</figure>

## A quote

> Good design is as little design as possible.
>
> — Dieter Rams, [Ten Principles for Good Design](https://www.vitsoe.com/us/about/good-design)

A horizontal rule, for when a section break is quieter than a heading:

---

That's the supported post-content set. Other site components live in their own
layouts, and anything added by a fork needs an intentional style.[^2]

[^2]: If you add elements of your own, this page can help you spot visual
    regressions alongside the retained automated checks.
