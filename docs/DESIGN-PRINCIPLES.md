# why quiet is built this way

Every decision should have an observable reason. Accessibility requirements
and measured behavior come first; the reading task comes second; named
heuristics and psychological effects are lenses, not mechanical proof.
This document records the reasoning, measurements, and deliberate refusals.

Current measurements are from the 2026-08-20 production candidate unless
stated otherwise.

The direction is influenced—not endorsed—by
[Dieter Rams's principles](https://www.vitsoe.com/us/about/good-design),
[Benji Taylor's simplicity, fluidity, and delight](https://benji.org/family-values),
[Nielsen's usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/),
and [WCAG 2.2](https://www.w3.org/TR/WCAG22/). Rams and Benji explain the
values; WCAG and retained tests decide whether the implementation works.

## the ordering principle

Function → Convenience → Aesthetics, strictly. A thing must work, then
remove friction, then create a meaningful experience. Beauty is never
applied on top; it is what remains when the first two are true. When
these conflict, the reader outranks the writer, and the writer outranks
the customizer.

## cognitive load

**Choice reduction** — Hick's Law is a useful lens, not a target count. The
reading path offers three familiar destinations (home, archive, about).
The color preference remains available in the footer without competing with
navigation. Post pages add only reading-related links: an optional table of
contents, heading permalinks, adjacent posts, and the same site navigation.

**Tesler's Law** — complexity is conserved; someone must absorb it. The
build absorbs it. Tables of contents, heading anchors, reading time, and
footnote plumbing are generated at build time from Markdown, so common posts
need no hand-written HTML and the reader never waits on JavaScript to assemble
the page. Authors can still use HTML when Markdown cannot express the needed
semantics, as the reference figure demonstrates.

**Von Restorff (isolation) effect** — the different thing is remembered.
Exactly one accent color exists, marking links, focus, and text selection.
Additional syntax colors occur only inside code blocks. Nothing competes for the
reader's attention, so when something *is* emphasized, it registers.

## perception and structure

**Gestalt proximity** — spacing does the grouping, not boxes or rules.
In the post list, the gap *within* an entry (title to description) is
**9px**; the gap *between* entries is **29px**. That 3.2:1 ratio is what
makes the list read as discrete items without a single divider line.

**Gestalt similarity** — inline and navigational text links share accent ink,
a 1px underline, and a consistent offset, so function is inferred from
appearance rather than learned. The wordmark, current-page label, and heading
permalinks rely on their established position and context instead. Headings
share one weight and family; size, spacing, and line height distinguish levels.

**Gestalt continuity** — one column, one primary left edge. Major blocks share
that axis; deliberate indentation distinguishes lists and quotations without
creating a second layout column.

**Law of Prägnanz (good form)** — the page resolves into the simplest
stable shape: a single column of text with a top and a bottom. There are
no floating panels, sidebars, or overlapping layers for the brain to
decode.

## interaction

**Target acquisition** — header and footer controls use real, non-overlapping
**44px-high** boxes. This exceeds
[WCAG 2.2's 24px minimum target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) without
making the labels visually heavy. Only the isolated code-copy button extends
its hit area invisibly, where it cannot overlap another control.

**Jakob's Law** — people expect your site to work like the others they
already know. So: links are underlined, the wordmark returns home, dates
sit next to titles, the archive is reverse-chronological, and the feed lives at
`/feed.xml` by default (under `baseurl` for project sites). Nothing here needs
to be learned.

**Affordance** — no mystery-meat navigation. Controls use labels rather than
unexplained icons; most text links are underlined, while the wordmark,
current-page label, and heading permalink use familiar placement and context.

**Nielsen's heuristics** — the parts that apply to a reading surface:
system status is honest (the copy button announces "copied" to screen
readers), state is visible (the current page is set in full ink at label
weight, not merely tinted), and there is no destructive action to undo.

**Serial position effect** — first and last are remembered. The home
page opens with the newest post and ends with the path to everything
else; a post opens with its title and date and ends with the adjacent
posts. The middle is never load-bearing for navigation.

## typography and proportion

- **Measure**: the container is capped at **36rem**, including 3rem of desktop
  padding. At 19px, the 627px prose column renders representative body lines
  at roughly 69–77 characters; a previously 87-character line now renders at
  74. It stays bounded rather than filling an ultrawide display.
- **Modular scale**: sizes use an approximately **1.2 ratio** — measured 1.20
  (h3/body), 1.20 (h2/h3), 1.18 (h1/h2). A consistent scale makes hierarchy
  feel intentional rather than arbitrary. (This is a rational scale, not the
  golden ratio: 1.618 between steps is too violent for body-adjacent text,
  where the steps must stay comparable.)
- **Line height 1.6** (measured 30.4px at 19px) and a fluid body size of
  **17px → 19px** keep the measure stable across the tested widths while
  preserving browser zoom.
- **Links stay underlined** in prose. Color is never the only signal.

## color and contrast

The primary screen palette uses semantic tokens authored in OKLCH with hex
fallbacks. Measured ratios: body text **16.4:1** (light) and **13.7:1** (dark) — AAA with
headroom; muted text 6.7:1 and 6.9:1; accent 5.2:1 and 7.5:1; code
tokens 6.2–8.7:1. High-contrast mode raises muted text and borders to
full ink; forced-colors mode is respected rather than fought.

The light background is warm off-white and the dark background is an
elevated near-black. The choice avoids visual extremes; contrast arithmetic,
not a claim about every reader's perception, is the acceptance criterion.

## emotional design (Norman's three levels)

- **Visceral** — the first impression is space and type, not chrome.
- **Behavioral** — the reference post transfers about 32KB of uncompressed
  HTML, CSS, and JavaScript before its content image; it works with JavaScript
  off, remains readable at 280px, and is keyboard-complete.
- **Reflective** — the identity the design offers the reader is
  "someone respected my attention." That is the whole intended feeling.

**Aesthetic-usability effect** — perceived polish can help an interface feel
easier, which is why restraint must be earned by function first. The design
may be noticed; it should never pull attention away from the text.

## the footer, and pages too short to scroll

A page shorter than the window creates a problem most sites answer by
accident: the leftover space has to go somewhere, and if it lands between
the last line and the footer, that gap changes with every window height —
measured at 256px in one window and 1,056px in another. Nothing about
that is a decision.

So the footer has exactly two states, both deliberate. When the page
scrolls, content ends a fixed distance above the footer's rule. When it
does not, the footer sits flush to the bottom edge and the slack sits
*above* that 1px rule, where it reads as the page's bottom band rather
than as spacing gone wrong. The footer's own internals never move: the
rule sits the same distance from the first footer line on every page at
every height. One spacing token owns the content-to-footer distance, so
two paddings can never compound into an arbitrary total.

## why there is no pagination

Measured on a 53-post build: the home page lists the newest five and
links to the archive; the archive comes to 3,284px — about three and a
half screens — and 11KB of HTML. Paging that would add URLs, "page 2 of
6" chrome, and a second mental model, and it would break the thing that
actually finds a post: the browser's find-in-page, which only searches the page
it is on. The measured archive keeps all 53 titles in that single search scope
at 11KB. A substantially larger publication should remeasure that tradeoff
rather than inherit this decision blindly.

## motion

One navigational gesture exists: a 150ms cross-fade between pages, with the
header held still (cross-document view transitions, CSS only). Short color,
border, and opacity transitions provide control feedback. Motion communicates
continuity or state rather than decorating the reading surface. Nothing moves
continuously while text is being read. Everything is disabled under
`prefers-reduced-motion`, and browsers without support simply navigate
instantly.

## what this deliberately refuses

Common blog-design advice recommends several things this template
declines. Each refusal is a decision, not an oversight:

| Recommendation | Why it isn't here |
|---|---|
| Reading progress bar | Persistent motion in the reader's periphery, sold as encouragement. A post's length is already visible in the scrollbar and the reading-time estimate. |
| Sticky/scroll-spy table of contents | Documentation needs a map; a linear essay does not. It also needs fallback behavior at short viewports and near the footer — complexity added to solve a problem the static TOC and heading anchors already solve. |
| Related posts / "you may also like" | Discovery here is the archive, the feed, and find-in-page. Recommendation grids often optimize for additional page views, which is not the reader's task here. |
| Newsletter CTA / popups / modals | Interrupting a reader to ask for something is a widely disliked pattern and conflicts with the reading task. |
| Author photo and bio block on every post | The about page and footer carry authorship. Repeating it above every article spends the reader's first screen on the writer. |
| Tags, categories, search | Genuinely useful at scale — and unnecessary for a modest personal blog, where one measured 53-post archive stayed compact enough for browser find-in-page. Nothing in the code prevents adding them later. |
| Social share buttons, view counters, reactions | Third-party requests, tracking, and social proof theater. The URL is the share button. |
| Web fonts | System stacks avoid another download and render in the reader's native environment. Self-hosting a font remains a documented recipe. |

The principle underneath the table: a product is good because of what it
does on purpose, not because it contains everything anyone might want.
Where a genuine minority need exists, the README's recipes cover it
(analytics and custom fonts) without imposing it on everyone who
forks this.

## environments this is verified against

Retained Playwright checks cover Chromium, Firefox, and WebKit at **280, 320,
390, 768, 1280, and 2560px** with no document-level horizontal overflow.
They also cover long unbroken titles, light/dark/system preference, keyboard
skip navigation, print, reduced motion, and a no-JavaScript pass. Hex colors
remain alongside OKLCH values as older-browser fallbacks. With JavaScript
disabled, only the theme and copy controls disappear; the table of contents,
heading anchors, archive, and article content remain build-time HTML, and the
Atom feed remains build-time XML.
