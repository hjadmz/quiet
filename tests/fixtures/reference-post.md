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

## A wide figure

A figure that opts out of the reading measure. It must stay inside the viewport
at every tested width, including the narrowest, and must not sprawl on an
ultrawide.

<figure class="wide">
  <img src="{{ '/assets/img/reference-image.svg' | relative_url }}"
       alt="The same fixture image, shown wider than the text column."
       width="1200" height="675" loading="lazy">
  <figcaption>A figure wider than the measure.</figcaption>
</figure>

## Embedded media

Declared far wider than the column on purpose. Without containment rules for
replaced content, one of these sets the width of the whole document and the page
scrolls sideways at every viewport — which is exactly how that shipped once.

<svg width="1400" height="60" viewBox="0 0 1400 60" role="img" aria-label="A wide grey bar.">
  <rect width="1400" height="60" fill="#888"></rect>
</svg>

<video width="1280" height="720" poster="{{ '/assets/img/reference-image.svg' | relative_url }}" controls></video>

## A running demo

{% include demo.html src="demos/hue-mixer.html" title="Hue mixer" height="220" caption="Drag the slider to change the swatch." %}

## A quote

> Good design is as little design as possible.

That is the complete controlled fixture.
