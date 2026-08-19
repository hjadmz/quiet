# why quiet is built this way

Every decision in this template traces to something measurable — a
psychological law, a typographic finding, or an accessibility standard.
This document records the reasoning and the numbers, including the
things it deliberately refuses to do.

Measurements below are from the live build at a 1280px viewport unless
stated otherwise.

## the ordering principle

Function → Convenience → Aesthetics, strictly. A thing must work, then
remove friction, then create a meaningful experience. Beauty is never
applied on top; it is what remains when the first two are true. When
these conflict, the reader outranks the writer, and the writer outranks
the customizer.

## cognitive load

**Hick's Law** — decision time grows with the number of choices. The
entire chrome offers **4 interactive choices** (home, archive, about,
theme). A post page adds nothing but the content's own links. There is
no menu to parse, so there is no decision to make before reading.

**Miller's Law** — working memory holds about 7 items. Nothing in the
interface asks the reader to hold anything: navigation is 3 items, and
the archive is grouped by year so each group is scannable on its own.

**Tesler's Law** — complexity is conserved; someone must absorb it. The
build absorbs it. Tables of contents, heading anchors, reading time, and
footnote plumbing are generated at build time from plain Markdown, so
the writer never hand-writes HTML and the reader never waits on
JavaScript to assemble the page.

**Von Restorff (isolation) effect** — the different thing is remembered.
Exactly one accent color exists, and it means exactly one thing:
"this is a link." Six text colors appear in total, and three of those
occur only inside code blocks. Nothing decorative competes for the
reader's attention, so when something *is* emphasized, it registers.

## perception and structure

**Gestalt proximity** — spacing does the grouping, not boxes or rules.
In the post list, the gap *within* an entry (title to description) is
**9px**; the gap *between* entries is **29px**. That 3.2:1 ratio is what
makes the list read as discrete items without a single divider line.

**Gestalt similarity** — every link looks like every other link
(accent ink, 1px underline, consistent offset), so function is inferred
from appearance rather than learned. Headings share one weight and one
family; only size separates the levels.

**Gestalt continuity** — one column, one left edge. Every block of text,
every heading, and every list shares the same alignment axis, so the eye
tracks straight down without re-acquiring the margin.

**Law of Prägnanz (good form)** — the page resolves into the simplest
stable shape: a single column of text with a top and a bottom. There are
no floating panels, sidebars, or overlapping layers for the brain to
decode.

## interaction

**Fitts's Law** — target acquisition depends on size and distance. Every
interactive target in the chrome measures **47–53px tall** (wordmark 50,
nav links 47, theme toggle 51, copy button 53, footer links 47) via
invisible hit-area extensions, exceeding the 44px touch guideline while
keeping the text itself visually small.

**Jakob's Law** — people expect your site to work like the others they
already know. So: links are underlined, the wordmark returns home, dates
sit next to titles, the archive is reverse-chronological, and the feed
lives at `/feed.xml`. Nothing here needs to be learned.

**Affordance** — no mystery-meat navigation. Everything clickable is
underlined text or a labelled button. There are no icon-only controls to
interpret.

**Nielsen's heuristics** — the parts that apply to a reading surface:
system status is honest (the copy button announces "copied" to screen
readers), state is visible (the current page is set in full ink at label
weight, not merely tinted), and there is no destructive action to undo.

**Serial position effect** — first and last are remembered. The home
page opens with the newest post and ends with the path to everything
else; a post opens with its title and date and ends with the adjacent
posts. The middle is never load-bearing for navigation.

## typography and proportion

- **Measure**: the prose column is **62 CSS `ch`**, which renders as
  **≈73 characters per line** — inside the 45–75 band that reading
  research treats as comfortable, and the reason the container is capped
  at 42rem rather than filling an ultrawide display.
- **Modular scale**: sizes are a **1.2 ratio** — measured 1.20 (h3/body),
  1.20 (h2/h3), 1.18 (h1/h2). A single ratio is what makes hierarchy feel
  intentional rather than arbitrary. (This is a rational scale, not the
  golden ratio: 1.618 between steps is too violent for body-adjacent text,
  where the steps must stay comparable.)
- **Line height 1.6** (measured 30.4px at 19px) and a fluid body size of
  **17px → 19px** across viewports, so the measure holds on any screen
  without the reader zooming.
- **Links stay underlined** in prose, always. Color alone is never the
  signal — roughly 8% of men cannot reliably use hue as information.

## color and contrast

Semantic tokens only, authored in OKLCH with hex fallbacks. Measured
ratios: body text **16.4:1** (light) and **13.7:1** (dark) — AAA with
headroom; muted text 6.7:1 and 6.9:1; accent 5.2:1 and 7.5:1; code
tokens 6.2–8.7:1. High-contrast mode raises muted text and borders to
full ink; forced-colors mode is respected rather than fought.

The light background is warm off-white and the dark background is an
elevated near-black — never pure white on pure black, which produces
halation that measurably slows reading, especially for astigmatic
readers.

## emotional design (Norman's three levels)

- **Visceral** — the first impression is space and type, not chrome.
- **Behavioral** — 27KB pages, no layout shift, works with JavaScript
  off, readable at 280px, keyboard-complete.
- **Reflective** — the identity the design offers the reader is
  "someone respected my attention." That is the whole intended feeling.

**Aesthetic-usability effect** — people judge attractive interfaces as
more usable, which is precisely why restraint has to be earned by
function first. The design is intended to be *unnoticed*; if the reader
notices it, it has failed.

## motion

One gesture exists: a 150ms cross-fade between pages, with the header
held still (cross-document view transitions, CSS only). Motion is used
for **continuity** — the sense that pages are one place rather than a
stack of documents — never for decoration. Nothing moves while text is
being read. Everything is disabled under `prefers-reduced-motion`, and
browsers without support simply navigate instantly.

## what this deliberately refuses

Common blog-design advice recommends several things this template
declines. Each refusal is a decision, not an oversight:

| Recommendation | Why it isn't here |
|---|---|
| Reading progress bar | Persistent motion in the reader's periphery, sold as encouragement. A post's length is already visible in the scrollbar and the reading-time estimate. |
| Sticky/scroll-spy table of contents | Documentation needs a map; a linear essay does not. It also needs fallback behavior at short viewports and near the footer — complexity added to solve a problem the static TOC and heading anchors already solve. |
| Related posts / "you may also like" | Discovery here is the archive, the feed, and find-in-page. Recommendation grids exist to increase page views, which is not the reader's goal. |
| Newsletter CTA / popups / modals | Interrupting a reader to ask for something is the single most-disliked pattern on the web. |
| Author photo and bio block on every post | The about page and footer carry authorship. Repeating it above every article spends the reader's first screen on the writer. |
| Tags, categories, search | Genuinely useful at scale — and unnecessary for a personal blog with tens of posts, where the archive fits on one screen and the browser's find-in-page is faster. Nothing in the code prevents adding them later. |
| Social share buttons, view counters, reactions | Third-party requests, tracking, and social proof theater. The URL is the share button. |
| Web fonts | 100–300KB and a third-party origin to change the shape of letters that already render natively on every OS. Self-hosting one is a documented recipe if you want it. |

The principle underneath the table: a product is good because of what it
does on purpose, not because it contains everything anyone might want.
Where a genuine minority need exists, the README's recipes cover it
(comments, analytics, custom fonts) without imposing it on everyone who
forks this.

## environments this is verified against

Layout measured with zero horizontal overflow and no stray elements from
**280px** (a folded Galaxy Fold, the narrowest real phone) through
320, 344, 390, 430, 512, 717, 768, 884, 1280, and **2560px** ultrawide,
on every page. System font stacks render natively on macOS, Windows,
Linux, iOS, and Android. With every modern CSS feature absent (no OKLCH,
no `color-mix`, no view transitions), the design still resolves
completely from its hex fallback layer — verified by stripping the
`@supports` blocks and re-rendering. With JavaScript disabled, only the
theme toggle and copy button disappear; everything else, including the
table of contents and heading anchors, is already in the HTML.
