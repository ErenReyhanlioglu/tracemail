# ADR-0047: Mobile Layout — Bottom Bar, Named Breakpoint, Stacked List Rows

**Date:** 2026-10-15
**Status:** Accepted (2026-10-16)

## Context

ADR-0039 made mobile a first-class target and deferred the phone layout
until the desktop was finished. The desktop screens are now done (health
panel core, lists, locked pages), and the site is linked from a CV, so a
phone is a likely first screen.

### Current state (measured 2026-10-15)

The web app has no width-dependent CSS: not one `@media (width ...)` rule.
A phone gets the desktop layout squeezed. Measured on production in headless
Chrome with mobile emulation (visitor, dark theme), as the document's
scroll width against the viewport width:

| Page | 390 px | 320 px |
|---|---|---|
| `/health` | 849 px | 848 px |
| `/postings` (locked) | 399 px (title) | 320 px |
| `/login` | 390 px | 320 px |

The owner's screenshots from a phone (signed in) and the emulation agree:

- **Sidebar.** It opens expanded on a first visit and takes about 65% of a
  390 px screen, leaving the content a column about 100 px wide. Collapsed,
  the icon rail still takes about 70 px. Its height is `100vh`, so the
  bottom (theme toggle, viewer label) sits under the browser's toolbar.
- **Lists.** The table and its footer are wider than the screen; position
  titles are cut, the search box overflows its card, the result count in
  the footer is cut.
- **Health panel.** Each row lays out label, value, and a fixed-width strip
  of day or hour cells side by side; the strips do not shrink, so the page
  is more than twice the screen width.
- **Page titles** are sized for the desktop and overflow at 390 px.
- **Locked-page game.** Tapping works (pointer events), but the copy names
  only the keyboard ("TEKRAR İÇİN SPACE").
- The login page fits.

### Guidance (read on 2026-10-15)

- **Reflow** (WCAG 2.2, 1.4.10, AA) [1]: at 320 CSS px, content scrolls in
  one direction only. Data tables, maps, diagrams, and games are excepted
  as parts that need two-dimensional layout; headings and search fields
  around them are not.
- **Target size** (WCAG 2.2, 2.5.8, AA) [2]: at least 24 × 24 CSS px, or
  enough spacing. Apple's guidelines use 44 × 44 pt and Material 48 × 48 dp
  (reported by secondary sources; the official pages did not load).
- **Navigation.** Hiding the main navigation behind a menu icon cut its
  discoverability almost in half in NN/g's study (179 participants, desktop
  and phone; the effect was smaller on phones) [3]. Tab bars suit a small
  number of options, at most about five, with labels under the icons, and
  stay visible while the page scrolls [4]. Icons other than a few (home,
  print, search) are ambiguous without a visible label; hover-only labels
  fail on touch [5]. Material's navigation bar is for two to five
  destinations on compact screens, with a rail for wider ones [6][7]
  (secondary sources; the Material page did not load). Apple: a tab bar is
  for navigation, never for actions; controls that act on the current view
  belong elsewhere [8].
- **Lists.** Design the large-screen table first, then reassess which
  attributes matter on the small screen; items must be legible without
  zooming; wordy cells fit about two columns on a phone; horizontal
  scrolling is acceptable for large tables but not a default, and when used
  its overflow must be visible [9]. Cards fit heterogeneous content such as
  dashboards; for similar items a plain vertical list is the better
  choice, and cards show fewer items per screen [10].
- **Viewport height.** `vh` equals the large viewport, so a `100vh`
  element extends under the mobile browser's toolbars; `dvh` follows the
  visible area, with `vh` as a fallback for older browsers [11].
- **Safe areas.** A bar fixed to the bottom needs padding of
  `env(safe-area-inset-bottom)` (with `viewport-fit=cover`) so the iPhone's
  home indicator does not cover it [12]; WebKit has open bugs around insets
  in installed web apps, so that case is tested on a device.
- **Form fields.** iOS Safari zooms into a field whose text is under 16 px
  and does not zoom back out; the fix is a 16 px minimum, not disabling
  zoom (developer reports, not an Apple document) [13].

### Keeping it from looking generic

No authoritative source defines "AI slop"; what the sources above and the
existing design system (ADR-0034) give are concrete rules that a generic
layout usually breaks:

- One navigation pattern per screen size, from the platform guidance, not
  a mix (rail and bar, or bar and drawer).
- Plain lists for the lists; cards only where the content is mixed (the
  health panel's sections already are).
- The existing tokens only: colors, IBM Plex Sans and Mono, spacing, and
  radii from `globals.css`; no new colors, gradients, shadows, or icons
  that the desktop does not have.
- Every icon in the bar has a visible Turkish label.
- Nothing decorative is added for the phone; a phone shows the desktop's
  information in one column, and drops only what the sources say to drop.

## Decision

The layout was built against the owner's mockups and reviewed screen by
screen on 2026-10-15 and 2026-10-16.

### Structure

1. **One breakpoint, named once.** Below 48rem (768 px) is a phone. The
   width is defined only in `src/app/media.css` as `@custom-media --phone`;
   every stylesheet writes `@media (--phone)`, never a width. PostCSS
   (`@csstools/postcss-global-data` and `postcss-custom-media`, as GitHub's
   Primer does [14]) makes the definition visible to each CSS Modules file
   and replaces the name with the query at build time. A named breakpoint
   in one place is what the surveyed design systems share (Primer's custom
   media, GOV.UK's Sass map, Tailwind's screens) [14][15].
2. **One markup, CSS decides.** Phones get no separate pages and no
   JavaScript width checks, so the server's first paint is already right.
   Each component keeps its phone rules at the end of its own stylesheet.
   Navigation is the one part with a separate phone component, as in the
   surveyed apps; the files that frame every page live in
   `components/shell/`, and the sidebar and the bottom bar read one list of
   sections (`navItems.ts`).
3. **Content-width rules stay container queries.** The health panel lays
   out by its own width (52rem and 30rem), so a tablet with the sidebar
   gets the narrow card layout too.

### Navigation

4. **A bottom bar** with the five sections, each an icon over a short
   visible label (Özet, İlanlar, Başvurular, Raporlar, Sağlık; the full
   name for screen readers), fixed and padded for the safe area [3][4][5];
   a lock badge on a visitor's locked sections.
5. **A top bar** with the logo and name, the theme as a 44 px icon button
   whose sun and moon turn into each other, and sign-in or sign-out [8].
   It scrolls with the page.
6. **No page titles on phones**: the bottom bar names the section; the
   heading stays for screen readers.

### Lists (applications and postings)

7. **No card; rows edge to edge** on the surface tone, the controls above
   them on the page tone, as the desktop card sits on the page.
8. **Toolbar**: the search first, 36 px tall with 16 px typed text (iOS
   zooms into smaller text [13]); under it one sideways-scrolling row with
   the filter chips (counts as quiet numbers) and, on postings, the period
   menu last. Edges with more chips beyond them fade as the row scrolls,
   where the browser ties animations to scrolling; elsewhere there is no
   fade. The period list opens under its button from its measured position,
   since the scrolling row would cut it off, and closes when anything
   scrolls. Spacing rule: the 16 px gutter; 12 px between groups, 8 px
   inside one.
9. **Summary line** in place of the column headers: "Filtreleri temizle"
   when filtered, and the order by the one date a phone row shows (last
   event, last sighting), a tap reversing it. No count: the chips carry the
   counts.
10. **Rows** on a fixed line grid (20, 18, and 20 px lines): position and
    date; company and location (applications) or mention count (postings);
    status and the posting link. Channel, first sighting, and "N gün önce"
    are not shown on phones.
11. **Pagination**: page links only, centred; one page on each side of the
    current one so the links fit 320 px; 20 rows a page, no size selector.

### Copy and defaults changed on every screen (owner's review)

12. Application statuses: "Yanıt bekleniyor" is "Yanıtsız", "Yanıtsız
    kapandı" is "Kapandı", and the silent badge reads "14+" (screen readers
    hear "14 gündür sessiz"); this amends ADR-0034's labels.
13. Posting status: a coloured dot and word, new orange, saved blue,
    applied green with its date; the period button turns accent blue while
    a period narrows the list. The postings list is sorted by last sighting
    by default (was first sighting), since a phone sorts by that date only
    and the server cannot tell the screen width; this amends ADR-0042. The
    note on later columns is removed.
14. Health panel, after the owner compared it with a status page: the
    introduction is rewritten and shorter; section notes that repeat what a
    section shows are removed ("gün başına bir kutu", "son 30 gün", "raporlar
    GitHub'da", the resources month); the dbt row's description goes and
    the freshness description is "en geç 2 saatte"; legends are shorter
    ("atlandı", "acil müdahale", "%85"); DORA's measures show name and
    value only, their counts no longer beside the medians (the rates keep
    theirs); deployment and incident text is cut to one and two lines.
    This amends ADR-0044 and ADR-0045.

### Health panel and locked pages on phones

15. Each stage is a card: the 24-hour axis once at the top, name and state,
    a muted description, a strip of near-square cells, and one detail line
    (last run, median). Status line as a 2 by 2 grid of bold values.
16. The locked page's content is placed from the screen's height, 40% of
    the free room above it, closed and open; opening lifts it on the
    game's own timing, so the envelope never crosses the text. Closing the
    game plays its opening morph backwards. The game names tapping on touch
    screens.

## Rationale

Alternatives considered:

1. **A menu button and a drawer.** Rejected: hidden navigation is found
   about half as often [3], and five sections fit a bar.
2. **The table scrolling sideways on phones.** Rejected: acceptable for
   large tables but not as a default [9]; the owner's mockups stack rows.
3. **A literal width in every stylesheet, checked by a script.** Rejected
   for the named breakpoint: no dependency, but a check guards a number
   that a name makes unnecessary, and the surveyed systems all name it.
4. **Breakpoints in JavaScript** (a `useMediaQuery` hook, as Bluesky's
   client-rendered app does [15]). Rejected: a server-rendered page would
   paint the wrong layout first.
5. **A fixed fade on the filter row** where scroll-linked animation is
   missing. Rejected by the owner: it needs room at the row's end that
   reads as a gap.

## Consequences

**Positive:** phones and tablets get layouts built for them from one markup;
the breakpoint changes in one line.

**Measured** (headless Chrome, mobile emulation, local server; the private
lists through a temporary page with invented placeholder rows, deleted
after each check):

- Horizontal overflow (document width minus viewport): 0 px at 320, 360,
  390, and 1280 px on the health panel, both lists, the locked pages, and
  the login page (before: 849 px on the health panel at 390 px).
- Health panel height at 375 to 390 px: 4,374 px before the review, 3,229
  px after.
- List row height at 390 px: 110 px to 93 px; title and date share a
  baseline (0 px), the second line within 1 px.
- Envelope against text while the game opens and closes, every frame: no
  overlap, closest 23 px.
- The production build compiles every `@media (--phone)` to the width query;
  no `--phone` is left in the served CSS.

**Negative / trade-offs:**

- The private lists were checked with placeholder rows and the owner's own
  screenshots; real data on a real phone is the owner's check.
- Two PostCSS dev dependencies (`postcss-custom-media` 12.0.3,
  `@csstools/postcss-global-data` 4.0.0, with `postcss` 8.5.28).
- Lighthouse mobile was not run before or after (ADR-0039 asks for it);
  it stays with the web pass in the roadmap, with the web app manifest.
- The fade on the filter row needs scroll-driven animations (Chrome,
  Safari 26); Firefox shows the row without it.
- Loading and transition states were left for later (ADR-0048).

## References

## References

1. [Understanding SC 1.4.10: Reflow — W3C WAI](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
2. [Understanding SC 2.5.8: Target Size (Minimum) — W3C WAI](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) (not read directly; criterion text from search results)
3. [Hamburger Menus and Hidden Navigation Hurt UX Metrics — NN/g](https://www.nngroup.com/articles/hamburger-menus/) (known from search-result summaries)
4. [Basic Patterns for Mobile Navigation: A Primer — NN/g](https://www.nngroup.com/articles/mobile-navigation-patterns/)
5. [Icon Usability — NN/g](https://www.nngroup.com/articles/icon-usability/) (known from search-result summaries)
6. [Build adaptive navigation — Android Developers](https://developer.android.com/develop/ui/compose/layouts/adaptive/build-adaptive-navigation) (known from search-result summaries)
7. [Navigation Bar, Material 3 — SAP Fiori for Android](https://www.sap.com/design-system/fiori-design-android/v26-4/components/m3-standard-components/navigation-bar/usage) (secondary source mirroring Material 3; m3.material.io returned no readable content)
8. [Tab bars — Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/tab-bars) (returned no readable content; known from search-result summaries)
9. [Mobile Tables: Comparisons and Other Data Tables — NN/g](https://www.nngroup.com/articles/mobile-tables/)
10. [Cards: UI-Component Definition — NN/g](https://www.nngroup.com/articles/cards-component/) (known from search-result summaries)
11. [The large, small, and dynamic viewport units — web.dev](https://web.dev/blog/viewport-units) (known from search-result summaries)
12. [env() — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env) (known from search-result summaries)
13. [Preventing iOS Textbox Auto-Zooming and ViewPort Sizing — Rick Strahl's Weblog](https://weblog.west-wind.com/posts/2023/Apr/17/Preventing-iOS-Textbox-Auto-Zooming-and-ViewPort-Sizing) (known from search-result summaries)
14. [primer/react — GitHub](https://github.com/primer/react) (read through the GitHub API: `packages/postcss-preset-primer`, `PageLayout.module.css`)
15. Repositories read through the GitHub API on 2026-10-15: [alphagov/govuk-frontend](https://github.com/alphagov/govuk-frontend) (`settings/_media-queries.scss`), [umami-software/umami](https://github.com/umami-software/umami) (`App.tsx`, `MobileNav.tsx`), [vercel/commerce](https://github.com/vercel/commerce) (`navbar/mobile-menu.tsx`), [dubinc/dub](https://github.com/dubinc/dub) (`main-nav.tsx`), [bluesky-social/social-app](https://github.com/bluesky-social/social-app) (`src/alf/breakpoints.ts`, `shell/bottom-bar/`)
