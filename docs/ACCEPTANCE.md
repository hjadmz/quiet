# acceptance report — quiet 1.1 candidate

Updated 2026-08-20. This report separates retained checks from historical
point-in-time audits. A dated pass is evidence for that build, not a permanent
property of every fork or host.

The current toolchain is Ruby 3.3.12, Bundler 2.6.9, Jekyll 3.10.0, Node 22,
Playwright 1.62.1, and axe-core 4.13.0. Ruby, gems, and npm packages are pinned
in the repository; CI runs with Bundler frozen.

## retained release checks

| # | check | current evidence |
|---|---|---|
| 1 | Generic template and production demo build from clean source | `npm run verify` validates the host-neutral build, `npm run verify:cloudflare` adds Cloudflare's output headers, and `npm run test:portable` simulates a customized fork with the demo posts and hjadmz overlay removed. `npm run verify:demo` additionally checks the exact demo routes, canonical origin, placeholder removal, and visible demo/AI disclosure. The build checks cover strict front matter, generated routes, local links/fragments, metadata, output exclusions, deployment headers, and budgets. |
| 2 | Generic and project-subpath builds remain portable | The default GitHub Pages config and a `/quiet` baseurl overlay both build and pass the same generated-site checks. |
| 3 | JavaScript is optional | A controlled post fixture keeps customization separate from the browser contract. Chromium, Firefox, and WebKit retain the article content, TOC, heading anchors, tables, and navigation with JS disabled. Theme and copy controls disappear rather than becoming dead UI. |
| 4 | Responsive layout does not widen the document | All three engines pass at 280, 320, 390, 768, 1280, and 2560px. Tests also inject long unbroken site titles, post titles, taglines, and footer identities. Wide tables and code scroll inside focusable regions. |
| 5 | Automated accessibility scan | axe-core 4.13 reports zero violations across the five controlled HTML routes in Chromium, Firefox, and WebKit. Production smoke checks separately cover all seven demo routes. This complements; it does not replace, keyboard and screen-reader review. |
| 6 | Skip navigation and keyboard flow | Activating “skip to content” focuses `main`; subsequent keyboard navigation bypasses the repeated header. TOC, heading permalinks, table/code scroll regions, theme, and copy controls are operable. Chromium and Firefox verify literal first-Tab order. WebKit verifies focus and activation without assuming macOS Keyboard Navigation; Safari's Option+Tab order remains a manual platform check. |
| 7 | Targets do not overlap | Header and footer controls are real 44px-high boxes at every tested width. The code-copy control is isolated and may extend its hit area without colliding with another control. |
| 8 | Reading measure and type | Desktop prose is 627px at 19px/30.4px. Representative body lines measure roughly 69–77 characters; the line that previously reached 87 now reaches 74. Body size remains 17–19px with 1.6 leading. |
| 9 | Contrast and preferences | Token calculations remain: body 16.4:1 light / 13.7:1 dark; muted 6.7 / 6.9; accent 5.2 / 7.5. axe checks rendered contrast. Reduced-motion, increased-contrast, forced-colors, light, dark, and system styles are present; the three-state preference persists and rejects invalid stored values. |
| 10 | Build-time content plumbing | Attributed headings retain custom ids/classes in the TOC and permalinks. Attributed tables retain their attributes inside labelled keyboard-scroll regions. Empty descriptions do not leave separators; image-only posts still show a one-minute minimum. |
| 11 | Feed, sitemap, and metadata | The source feed template stays byte-for-byte aligned with jekyll-feed 0.17 except for two targeted role removals; the plugin still provides discovery metadata and deliberately skips the existing feed path. Strict XML checks cover full entry content, timestamps, authors, canonical/self/footer links, subpaths, footnote targets, and sitemap exclusion. jekyll-sitemap generates the sitemap. `last_modified_at` feeds visible and machine-readable update metadata. |
| 12 | Images and print | The demo image loads at its declared 1200×675 intrinsic size. Print hides site chrome, theme, copy, TOC, and adjacent-post navigation and returns to black on white. |
| 13 | Runtime budget | Generated-site checks report current payload sizes and fail above budgets of 20 KiB CSS, 1 KiB inline theme JS, and 2 KiB conditional copy JS. |
| 14 | No unused theme payload | `theme: null` records the deliberate no-theme choice; generated pages link only this template's stylesheet. Source, docs, tests, lockfiles, and `node_modules` are excluded from `_site`. |
| 15 | Cache and security policy is version-safe | CSS and conditional JS URLs receive a build version. `_headers` applies nosniff, a restrained referrer policy, disables camera/geolocation/microphone, sets `no-transform` for documents, and gives versioned CSS/JS one-year immutable caching. Asset rules detach the inherited cache header before replacing it, avoiding contradictory max-age values. |

## evidence boundary

The 2026-08-19 v1.0 audit recorded Lighthouse 100/100/100/100 and zero CLS
for its then-current build. Those numbers were not rerun for 1.1 and are not
presented as current acceptance evidence. The retained suite now supplies the
repeatable route, accessibility, browser, interaction, responsive, source,
and budget checks that were previously only described in prose.

The source build makes no third-party runtime request. Hosting can change that.
Before promoting 1.1, the Cloudflare preview must also prove:

1. deployment trigger is `github:push` for the exact reviewed commit;
2. Ruby is 3.3.12, Bundler is frozen, and the build command is
   `npm run verify:demo`;
3. `_headers` is active, HTML includes `no-transform`, and CSS/JS return one
   unambiguous immutable cache policy;
4. no Bot Fight Mode/Javascript Detection bootstrap, `/cdn-cgi/` request,
   hidden challenge iframe, or `cf_clearance` cookie is injected;
5. canonical metadata remains `https://quiet.hjadmz.com`, routes return the
   intended statuses, and the custom domain/TLS/DNS stay active.

## deliberate deviations

- The visible home title is the header wordmark; the structural h1 remains for
  assistive technology without repeating the same words on screen.
- The theme preference lives in the footer. It matters, but it is not a
  reading destination and should not shift or crowd primary navigation.
- Hex fallbacks accompany OKLCH tokens so older browsers receive a complete
  palette rather than a broken one.
- Reading time uses a 220-WPM estimate, rounded up with a one-minute minimum;
  it never displays zero.
- The archive date column omits the year because the year already labels each
  group.
- README screenshots stay under `docs/`, which is excluded from production.
