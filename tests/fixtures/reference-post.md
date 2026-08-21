---
title: everything a post can do
description: a controlled fixture for quiet's post layout and interactions.
toc: true
---

This fixture exercises the template's reading and interaction contracts.[^1]

[^1]: The return link must remain usable without custom scripting.

## Text

Body text includes [an underlined link](#text), *emphasis*, **weight**, and
`inline code`.

### Headings get anchors
{: #deep-links .reference-heading}

Custom heading ids and classes must survive TOC and permalink generation.

#### Down to level four

The fourth level checks the complete heading-anchor transform.

## Lists ||| stay @@@ readable
{: #sentinel-heading}

- one useful item
- one restrained item

## A table

| year | posts | words |
|---|---:|---:|
| 2026 | 7 | 9,105 |
{: .wide}

## Code

```js
function readingTime(text, wpm = 220) {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wpm));
}
```

## An image, with a caption

<figure>
  <img src="{{ '/assets/img/reference-image.svg' | relative_url }}"
       alt="A small dark square on a warm off-white field."
       width="1200" height="675" loading="lazy">
  <figcaption>A stable 16:9 image fixture.</figcaption>
</figure>

## A quote

> Good design is as little design as possible.

That is the complete controlled fixture.
