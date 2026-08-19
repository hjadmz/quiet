# acceptance report — quiet v1.0

Every item from the build spec's checklist, marked with measured results.
Measured 2026-08-19 on the production build (Jekyll 3.10.0 — the same
version GitHub Pages runs — with the three whitelisted plugins), after a
30-finding multi-agent review (6 dimensions, each finding adversarially
verified) and the fixes that followed.

| # | check | result | measured |
|---|-------|--------|----------|
| 1 | Fresh fork personalizes with only `_config.yml` edits | **pass** | simulated fork: 8 config edits (title, tagline, author, url, accent, accent_dark, body_font, footer) → clean build, all values applied, zero edits outside the config |
| 2 | Fully functional with JavaScript disabled | **pass** | sandboxed no-scripts load: toggle hidden, no copy buttons, TOC + anchors + footnotes + full content all present (they're build-time HTML) |
| 3 | Lighthouse mobile 100/100/100/100 on Home and kitchen-sink post | **pass** | home: 100/100/100/100 · post: 100/100/100/100 (perf/a11y/best-practices/SEO), headless Chrome, final build |
| 4 | Zero third-party requests | **pass** | every href/src is same-origin; no fonts, no CDNs, no analytics; Lighthouse network shows only same-origin requests |
| 5 | axe: 0 violations on every page; validator passes | **pass** | axe-core 4.x on all 7 pages: 0 violations. html-validate structural rules: 0 problems on all 7 pages. (W3C's vnu not run locally — no Java runtime; kramdown's self-closing voids and colon footnote ids are valid HTML5.) Titles/descriptions are HTML-escaped, so hostile strings (`& < > "`) can't produce invalid markup — regression-tested with a torture post |
| 6 | Keyboard-only walkthrough | **pass** | tab order measured: skip link → wordmark → archive → about → toggle → TOC → content; scrollable code/table regions focusable (`tabindex="0"`); heading anchors have unique labels ("permalink to Text", …); copy verified with a real click (clipboard write confirmed, "copied" announced via live region); footnote round-trip is plain anchors with `:target` highlight |
| 7 | Body ≥ 7:1, all text ≥ 4.5:1, both themes | **pass** | computed from OKLCH→sRGB: body 16.4:1 light / 13.7:1 dark; muted 6.7 / 6.9; default accent 5.2 / 7.5; code tokens 6.2–8.7 on their surface |
| 8 | No theme flash on dark reload | **pass** (structural) | the 600 B theme script is inline in `<head>` *before* the stylesheet link and sets `data-theme` pre-paint; `<meta name="color-scheme">` covers pre-CSS canvas paint |
| 9 | 320 px: no horizontal scroll | **pass** | document scrollWidth 305 at a 320 px viewport on the kitchen-sink page; wide tables/code scroll inside their own focusable containers |
| 10 | Feed validates, full content; sitemap present | **pass** | feed.xml well-formed (xmllint), full `<content type="html">`; `last_modified_at` propagates to feed `<updated>`, sitemap `<lastmod>`, and JSON-LD `dateModified` (verified equal); sitemap lists all 6 pages, excludes 404 |
| 11 | Zero CLS; all images have dimensions | **pass** | Lighthouse CLS = 0 on both audited pages; the demo figure carries explicit `width`/`height` + `loading="lazy"` |
| 12 | Print preview clean, chrome-free | **pass** | print-to-PDF inspected: no header/nav/footer/toggle/TOC/copy buttons; black-on-white; URLs printed after external links |
| 13 | Page weight within budget | **pass** | kitchen-sink post: HTML ~13 KB + CSS 15.8 KB + copy.js 1.0 KB ≈ 30 KB excluding content images (budget ≤ 60 KB). CSS 16,206 B unminified against a 16,384 B ceiling — only 178 B of headroom left, so the next feature should replace CSS rather than add it. Theme script 600 B (≤ 600 B); copy.js 1,019 B (≤ 1 KB); total JS 1,619 B (≤ 2 KB). Re-measure this row whenever the CSS changes. |
| 14 | Project-site `baseurl` mode untouched | **pass** | built with `--baseurl /quiet`: 0 unprefixed internal refs across all pages |
| 15 | `prefers-reduced-motion` and `prefers-contrast: more` | **pass** | reduced motion kills all transitions/animations with `!important`; contrast-more raises muted/border to full ink via a `(0,2,0)`-specificity selector verified to win in all five theme states (a specificity bug here was caught by review and fixed) |

## deviations from the build spec

Each deliberate, each documented:

- **`theme.js` lives in `_includes/`, not `assets/js/`** — Jekyll can only
  inline files from `_includes/`; the spec required build-time inlining, which wins.
- **The shipped favicon is a plain "q" wordmark** — a template's default
  mark should be obviously replaceable rather than decorative; `favicon`
  and `apple_touch_icon` are config paths.
- **Home page's visible title is the header wordmark** — a second visible
  site title two lines under the wordmark read as a stutter; the h1 is
  visually hidden but present for structure and screen readers.
- **Hex fallbacks accompany the OKLCH tokens** — same measured values;
  pre-2023 browsers get identical colors instead of broken ones. OKLCH
  remains the authored source of truth.
- **The update key is `last_modified_at`, not the spec's `updated`** —
  it's the only key jekyll-feed / jekyll-seo-tag / jekyll-sitemap read,
  so the visible date and the metadata can never disagree. `updated`
  still displays if used, but doesn't reach feeds.
- **Reading time uses ceiling, not rounding** — it never understates and
  guarantees "1 min read" minimum; the demo snippet matches.
- **The archive's date column is month + day** — the year lives in the
  group heading; `date_format` governs posts and the home list.
- **The default social image is set by file replacement or the
  `defaults:` block** (both in `_config.yml`'s domain) — a bespoke
  `og_image` key would be dead code, since jekyll-seo-tag only reads
  per-page `image`.
- **Chrome links reach ~44 px tall via invisible hit-area extensions**;
  the narrowest labels ("rss") stay under 44 px *wide* so adjacent
  targets never overlap — WCAG 2.5.8's 24 px floor is exceeded everywhere.
- **README screenshots live in `docs/`** (excluded from the built site)
  so they never ship to readers.
