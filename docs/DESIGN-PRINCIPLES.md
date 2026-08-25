# why quiet is built this way

Every decision should have an observable reason. Accessibility requirements
and measured behavior come first; the reading task comes second; named
heuristics and psychological effects are lenses, not mechanical proof.
This document records the reasoning, measurements, and deliberate refusals.

Current measurements are from the 2026-08-24 production candidate unless
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

## a setting cannot break the site

The person most likely to mistype a setting is editing `_config.yml` in the
GitHub web editor, with no terminal, no build log, and no npm. Any answer that
reaches only a maintainer is not an answer for them. So the guarantee is split
in two, and both halves are build-time and plugin-free:

**The site keeps working.** `_includes/config.html` is the only place a raw
`site.<setting>` is read. It normalizes, range-checks and type-checks every
value, and hands the templates a `q_*` variable that is always usable. A value
that cannot be used is replaced by the documented default. `posts_on_home` is
the worked example: `1000` clamps to 100, `-10` and `0` clamp to 1, `abc`,
`3.7`, `true` and `[5, 10]` all fall back to 5, and `all` is a real value
because someone who typed 1000 meant "all" and deserved a word for it.

**The author is told.** Every substitution appends one plain sentence to a list
rendered at `/site-check/` — unlinked, `noindex`, out of the sitemap, and free
for any reader who never visits it. The same page reports problems the config
cannot see: two posts resolving to one address, a date Ruby will read
differently than it was written, `draft: true` used as though it hid a post.

Two decisions inside that are worth naming. Values are **escaped where they are
printed, not where they are stored**, so one rule covers text and attribute
positions without the normalizer guessing which is which. And the accent — the
only setting written into a stylesheet, and so the only one that could
restructure a page rather than merely mislabel it — is checked twice: characters
that could end a declaration, a rule, or the `<style>` element are refused at
build time, and what survives is wrapped in `@supports (color: …)` so the
browser itself decides whether it is a real color. A hostile value is dropped by
the first gate, a merely wrong one by the second, and neither reaches a reader.

**The trap underneath all of it is YAML itself.** Validation runs on values that
YAML has already interpreted, and it interprets more than people expect. The bare
words `no`, `yes`, `on` and `off` become booleans before any of this code sees
them — and `no` is the language code for Norwegian, so `lang: no` was producing
`<html lang="false">`: a valid attribute, a page that looks fine, and nothing to
tell anyone. `title: on` rendered the site name as "true". `author.name: yes`
printed "© 2026 true" in the footer. All three were silent.

Booleans are detectable in Liquid, so those four keys are now checked for type
before they are checked for content, and a boolean falls back and says why. Two
related traps cannot be detected, because YAML destroys the evidence before the
template runs: a `#` in an unquoted value truncates it, and a colon-space stops
the build. Both are answered the only way left — the config file leads with the
rule that fixes all three at once, which is to quote the value.

`footer:` written flat or as a list is the same class of silent failure by a
different route: it parses, `site.footer.github` becomes unreadable, and both
links disappear. That one is checked by shape.

The residue is recorded rather than hidden: `jekyll-seo-tag` prints `site.lang`
and `site.author.name` into meta tags without escaping them, which no template
can prevent. `tests/config-lint.cjs` fails the build on any inline event handler
in the output — the template writes none, so one can only have arrived from a
value that escaped its attribute.

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

## one accent, and why not two

The accent existed as a pair: `accent` and `accent_dark`, with the second
defaulting to the first. That default is wrong for almost every colour a person
would choose. Measured across 36 hue-and-chroma combinations, reusing the light
accent on the dark background fell below 4.5:1 **every time**, from 1.32:1 to
3.56:1 — so the shipped behaviour for anyone who set one colour and stopped was
a dark mode with unreadable links.

Deriving it instead — same hue, fixed lightness, slightly less chroma, which is
the exact relationship the built-in pair already had — cleared 4.5:1 on all 36,
between 6.90:1 and 8.24:1. Verified rendered in Chromium, Firefox and WebKit: a
terracotta set once measures 5.56:1 in light and 7.12:1 in dark.

So the second setting is gone. This is the shape the whole config is meant to
have: not "expose a knob for every value", but "compute what can be computed,
and ask only for what genuinely differs between one person's site and another's".
A browser without relative colour syntax skips the derivation and gets the old
behaviour; nobody gets worse than before.

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

**The theme control shows its state, and says it too.** The icon changes with
the mode — sun, crescent, half-filled circle — and the word beside it spells the
mode out. That redundancy is deliberate on both sides: the glyph is what the eye
lands on while scanning a row of text links, and the word is what makes the
glyph unambiguous, since "follow the system" has no universal symbol. It is also
what makes the control findable, because typing "theme" into find-in-page lands
on it.

The two icons not currently shown cost about 272 B gzipped per page. That was
measured and judged worth paying: a control that announces its state at a glance
is the point of having an icon at all, and an icon that never changes is
decoration.

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

## a map of the post, not of the page

The contents list is opt-in, built at build time, and lists **h2 only**. That cut
came from a measurement rather than a preference: on a six-section post with
sub-headings, including h3 produced 16 entries and a 528px block that filled 63%
of a phone's first screen — the reader opened an article and saw a list of
headings where the writing should be. h2 alone gives 6 entries and 233px, and the
opening paragraph is visible on load.

It is also the more honest cut. A contents list answers "what shape is this, and
where do I jump in", which h2s answer; h3s are subdivisions you meet on the way
through a section, not destinations you choose from the top. Removing them
deleted the nesting logic from the include entirely.

The box went too. It was the only bordered panel in a design that groups
everything else by spacing — the post list uses a measured 9px-within,
29px-between ratio and not one rule — and a bordered stack of links at the head
of an article is precisely the shape readers have learned to skip. Rules above
and below, entries in body ink with a soft underline, accent on hover. The list
now belongs to the article instead of sitting on top of it.

Nothing was added to replace what it does not do. A scroll-following highlight
needs script, needs a fallback at short viewports and near the footer, and puts
a persistently updating element in peripheral vision while text is being read —
and the static list already answers the question a reader is asking.

## the reply channel

There are no comments, no reactions and no counter, which leaves the question
they were all badly answering: how does a reader tell you something? Every
mechanism that keeps state needs a server, and on a static host that means
someone else's — the one thing this template refuses.

So the answer is the one that predates all of them. Set `footer.email` and it
appears twice: in the footer, and as a line under every post that carries the
post's title in the subject, so a reply arrives with its context attached. It
asks a question — "thoughts on this?" — rather than issuing a call to action,
and it renders only when there is an address to send to.

That is also why `footer.email` is documented as more than a footer link. It is
the only channel in the template, and a fork that leaves it empty has quietly
decided not to hear from anyone.

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

## the front page is an invitation, not an index

`posts_on_home` caps at 20, and the number came from measurement rather than
taste. On a 390×844 phone the home page runs 1.4 screens at five posts, 2.2 at
ten, 3.7 at twenty, 8.4 at fifty and **16.1 at a hundred** — at which point the
front page *is* the archive, and the "all posts →" link sitting under it points
at a page the reader has just finished scrolling through. Two pages doing one
job, which is the duplication the archive exists to prevent.

Twenty is where it stops being an invitation. Below that a reader takes the list
in and picks; above it they are browsing an index they did not ask for. The word
`all` is still there for someone who genuinely wants every post on the front
page — that is a decision, not an accident, and it should be spelled as one.

The floor matters less and is simpler: a front page with no posts on it has
nothing to read, so the minimum is one.

## the archive is the search box

Refusing search only works if the substitute does. Find-in-page can only match
text that is on the page, and the archive carried titles and dates alone —
measured on a 53-post build, 1,828 searchable characters. A reader looking for a
topic they remembered but could not name would find nothing, and the refusal was
two-thirds honest.

The archive now prints each post's description. The same build measures 5,571
searchable characters (3.05×), for 7 KB of HTML and a page that grows from 3.6
to 5.7 desktop screens. Roughly doubling the height of the one page whose only
job is finding things, to triple what can be found on it, is the right trade.

It is also what sets the threshold for revisiting the decision: not a post
count, but the point where the archive stops being scannable in one pass —
around ten phone screens, or 100 KB of HTML.

Measured at the far end so the ceiling is a number rather than a worry: a
500-post site builds in 6.4 seconds, generates all 504 pages, lists every post
on the archive, and loads that archive in 48 ms on a phone with no horizontal
overflow — 158 KB raw, 13 KB gzipped, 54,527 characters in one find-in-page
scope. Nothing breaks; it is simply 62 phone screens long. The design holds
comfortably to roughly 75–100 posts and keeps working well past that, which
makes the archive a choice rather than a ceiling.

The 404 page routes there too. Someone reading it followed a dead link to a
specific post; the home page shows five, and the archive shows everything.

## read-aloud belongs to the reader, not to the page

A reader who listens has already chosen a voice, a speed, and a tool, and has it
configured across every site they visit. A play button on one blog cannot beat
that; it can only add a second, worse control with a voice they did not pick. The
honest position is to defer — but deferring is only respectful if the page is
actually legible to those tools, so that is checked rather than assumed.

Firefox is the one engine that exposes its reader view to automation, and it uses
Readability, the same extractor behind Safari Reader and most read-aloud
features. A retained check runs the reference post through it and asserts:

- the article survives extraction — measured **more than 60% of the rendered
  text**, compared as a fraction rather than a character count so the assertion
  does not rot as the fixture grows;
- the title and every section heading come through, so listening can be navigated;
- **heading permalinks do not** — otherwise every heading is spoken as "Text,
  number sign";
- the table of contents does not either, since it would be read out in full
  before the article it describes;
- code blocks survive, because a technical post without them is not the post;
- and a demo's caption survives even though the demo cannot, so a listener still
  learns what was there.

What the template deliberately does not do is guess at punctuation verbosity in
code. That is a setting inside the reader's own software, tuned to their
preference, and a page that tried to override it would be doing the thing this
section exists to refuse.

## showing work, not just describing it

The one capability added rather than refused. A demo is an ordinary HTML file
under `_includes/demos/`, inlined into the page at build time as an
`<iframe srcdoc>` sandboxed with `allow-scripts` and *without*
`allow-same-origin`.

That combination is what makes it acceptable here. Inlining means the page makes
no additional request, so "no third-party runtime" stays true by construction
rather than by policy. The missing `allow-same-origin` gives the frame an opaque
origin: verified, the parent gets a `SecurityError` reading into it, and the
demo cannot touch the page, its cookies, or its storage. Files under
`_includes/` never become URLs, so a demo cannot be crawled or linked as a page.
With JavaScript off the frame still renders its static starting state and the
figcaption still explains it.

The alternative — a real file in the output that an iframe fetches — works in a
browser and fails this repo's own checks, which assert that every generated HTML
file is a whole page. That is the check being right.

`class="wide"` is the same idea for still content: 36rem is correct for text and
wrong for a screenshot, and without a way out the choices are a second layout or
an author fighting the stylesheet. It caps at 52rem so an ultrawide does not
stretch it, and subtracts the gutters so a classic scrollbar cannot turn `100vw`
into overflow.

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
| On-site search | Both implementations fail the constraints: a client-side index needs JavaScript and reimplements a control the reader already owns, and a hosted one is a third-party request on every page. The archive is the substitute, and it only became an honest one when it started carrying descriptions — see below. |
| Tags and categories | A retrieval structure that pays once the archive stops being scannable in one pass, which is a height, not a post count. Feed readers already get `<category>` entries from `tags:` front matter, so the refusal is of tag *pages*, not of tags. |
| Social share buttons, view counters, reactions | Third-party requests, tracking, and social proof theater. The URL is the share button, and heading permalinks let a reader share a section, which the URL bar alone cannot. |
| Built-in text-to-speech | Several KB of JavaScript to reimplement Safari Reader, Edge Read Aloud, and every screen reader — and the word-highlighting half depends on `speechSynthesis` boundary events, which are least reliable on iOS, where reading aloud is most used. Refusing it only counts if the tools people already have work here, which is now a test rather than a claim — see below. |
| A licence line in the footer | Real, but it buys a config key for a decision most people make once and never revisit. The README says MIT; a fork that relicenses says so in its own LICENSE file. The copyright line already carries the year span and the name. |
| A webmention endpoint or h-card | Receiving webmentions needs a server, and every hosted alternative is a third-party request on every page — the one thing this template does not do. `rel="me"` on the footer's GitHub link is the piece of the same idea that needs nothing, so that is the piece it ships. |
| `theme-color`, a web app manifest, `security.txt`, `humans.txt` | Four things that look like completeness. `theme-color` cannot follow the manual toggle without script that keeps it in sync, and buys almost nothing against this palette; a manifest is for an app; `security.txt` is for a service with a vulnerability process; `humans.txt` is a colophon nobody opens. A fork that needs one has a reason the template does not. |
| Back to top, a site-wide "updated" date, a sitemap link | The header is on every page and its archive link goes where a back-to-top would; `last_modified_at` is the updated date, per post, where it means something; the sitemap is for crawlers and they find it in `robots.txt`. |
| A photo or work gallery | A second layout, a second content type, and a second answer to "where is the index of the work". A post *is* the showcase: `class="wide"` for stills, an inlined demo for anything that runs. |
| Web fonts | System stacks avoid another download and render in the reader's native environment. Self-hosting a font remains a documented recipe. |

The principle underneath the table: a product is good because of what it
does on purpose, not because it contains everything anyone might want.
Where a genuine minority need exists, the README's recipes cover it
(analytics and custom fonts) without imposing it on everyone who
forks this.

## what a reading surface owes an RTL language

`lang` accepts `ar`, `he`, `fa` and the rest, so the layout has to mean it.
`dir` is derived from `lang` rather than configured, because asking for the same
fact twice is one more thing to get wrong, and the CSS uses logical properties
wherever the physical ones would have pinned bullets, quote rules, table columns
and adjacent-post links to the left in a right-to-left document.

The one place physical is correct is the display-cutout inset: a notch is a fact
about the hardware, not about the writing direction, and must not flip. Code is
also explicitly `direction: ltr; unicode-bidi: isolate` — a snippet reads
left-to-right inside an Arabic post.

The measured result: identical geometry in both directions at 280, 320, 390,
768, 1280 and 2560px, and zero horizontal overflow in RTL. Before this, one
off-screen skip link positioned at `left: -999rem` put ~17,000px of sideways
scroll into any RTL document — an offset that is harmless only in the direction
the document cannot scroll.

## environments this is verified against

Retained Playwright checks cover Chromium, Firefox, and WebKit at **280, 320,
390, 768, 1280, and 2560px** with no document-level horizontal overflow — now
including a post that embeds a 1400px SVG, a 1280×720 video, a wide figure and a
running demo. Without containment rules for replaced content those measured
1,417px of content inside a 280px viewport, scrolling the whole document
sideways at every width; the fixture carries them so that cannot return.
They also cover long unbroken titles, light/dark/system preference, keyboard
skip navigation, print, reduced motion, and a no-JavaScript pass. Hex colors
remain alongside OKLCH values as older-browser fallbacks. With JavaScript
disabled, only the theme and copy controls disappear; the table of contents,
heading anchors, archive, and article content remain build-time HTML, and the
Atom feed remains build-time XML.
