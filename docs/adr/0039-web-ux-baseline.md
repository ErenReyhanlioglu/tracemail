# ADR-0039: Web UX Baseline — States, Mobile, and Accessibility

**Date:** 2026-10-13
**Status:** Accepted (not yet implemented)

## Context

The site goes public with its domain, linked from a CV, so its first
visitors are often on a phone. Step 1.10 built the owner's lists for the
desktop and the happy path; the design system (ADR-0034) fixed tokens and
colors, not behavior. The owner's goal is a mobile UI as polished as the
desktop one; mobile was deferred only because the desktop UI was not
finished either.

Until the public health panel and the visitor skeletons arrive (Phase 3),
the lists are behind login: a visitor opening the site sees only the login
page, and the not-found and error pages when something goes wrong.

### Current state (code read on 2026-10-13)

| Area | Today |
|---|---|
| Session missing or expired (API 401) | Redirect to the login page |
| API error (5xx) | One message, "data unavailable", with status 200 |
| API unreachable (network error) | Not caught: Next.js's default error page, in English |
| Unknown address | Next.js's default 404 page, in English |
| While a list loads | Nothing; the page appears when the data does |
| Empty list | One message for "no records" and "no record matches this filter" |
| Narrow screens | No breakpoint: the sidebar keeps its full width on every screen |
| Tables | Scroll sideways inside their own container; headers centered, not sticky |
| Data freshness | Not shown, although the data changes hourly |
| Accessibility basics | `lang="tr"`, a visible focus style, a labelled page-size select, a text label on the icon-only theme toggle |

A measured baseline (Lighthouse in Chrome, signed in, desktop and mobile)
is recorded here before any change; see "Measurements".

### Guidance (read on 2026-10-13)

- **Usability heuristics** [1]: keep users informed of system status;
  speak the user's language, not jargon; let users back out easily; be
  consistent; prefer recognition to recall; keep the design minimal; help
  users recognize, diagnose, and recover from errors; provide help in
  context.
- **Error messages** [2][3]: visible (and never by color alone),
  polite, precise, constructive, never blaming the user, and reducing the
  effort to recover.
- **Error pages** [4][5][6]: "Page not found" as title and heading, no
  "404" jargon, no informal wording, only useful links; for unexpected
  errors one page for all, "try again later", a 5xx status, and every error
  logged.
- **Empty states** [7][8]: say why the view is empty and what can be done;
  treat "nothing yet" and "no results for this filter" differently, and
  offer a way out of the second (clear the filter).
- **Loading states** [9]: under about one second, neither a skeleton nor a
  spinner is needed, and a brief flash can feel jarring; from about two to
  ten seconds a skeleton suits a full page. The recommended skeleton mirrors
  the final layout ("content-only"); one that shows only the frame reads as
  a broken page. Shimmer signals activity but can distract or create
  accessibility problems.
- **Visual design** [10]: build hierarchy with one lever (size, weight, or
  color) at a time; take spacing from a fixed scale; design so the meaning
  survives in grayscale, then add color.
- **Data tables** [11][12]: "Left-align text, including non-countable
  numerals such as dates and phone numbers"; right-align numbers; "Align
  each heading the same way as the data in its column." Both sources were
  read directly.
- **Accessibility** [13][14][15]: WCAG 2.2 AA. At 320 CSS pixels wide the
  page scrolls in one direction only; data tables may scroll sideways
  inside their own container. Pointer targets are at least 24 by 24 CSS
  pixels, or spaced so that a 24-pixel circle around each does not touch
  another; inline links in text are exempt. The WebAIM Million 2026 found
  low-contrast text on 83.9% of home pages, the most common failure;
  missing form labels, link and button text, alt text, and document
  language make up most of the rest.
- **Limits of automated checks** [16][17][18]: GOV.UK tested ten tools on a
  page with 143 known barriers; together they found 71%, the best single
  tool 41%, and 29% were found by none: tools "cannot be relied on, by
  themselves". Deque, the maker of axe, reports that axe covers 57% of
  issues by volume across its audits (a vendor figure, counted by issue
  volume, not by success criteria). Lighthouse's accessibility score is a
  weighted pass/fail of axe-based audits; it lists ten manual checks (focus
  order, keyboard focusability, focus traps, landmarks, visual order
  following DOM order, and others) that do not affect the score.
- **Generic "AI-generated" look** [19][20] (opinion pieces, but consistent):
  default fonts (Inter, Roboto), purple-blue gradients, a gray border on
  every card, glass effects, nested cards, oversized radii, invented
  metrics, the same fade-in everywhere. The remedy is a committed design
  direction kept in tokens, real content, and restraint.
- **Next.js streaming** [21]: a page with a `loading.tsx` starts streaming
  with status 200, and the status cannot change afterwards; a 404 streamed
  later carries a `noindex` meta tag instead.

### Data freshness: where "last checked" comes from

The marts' last-modified time is the wrong signal: dbt builds only when new
mail changed `landing` (ADR-0022), so after hours without mail the lists
would look stale although every hourly run succeeded. The run records in
`ops` hold the right one, and the view `marts.fct_job_freshness` (ADR-0020)
already exposes each job's last success; as a view it is current at read
time. `tm-api` reads only `marts`, and a view whose sources it cannot read
fails for it unless the view's dataset is authorized on the source datasets
[22] — the step `infra/gcp/README.md` already anticipates for the Phase 3
health views. An authorized dataset gives the views read access to the
source, not the API account [22].

## Decision

A baseline every screen meets, now and in later phases. The desktop is
finished first; the mobile layout follows.

1. **Mobile as a first-class target.** WCAG 2.2 AA reflow holds on every
   screen: at 320 px the page scrolls vertically only, and a data table may
   scroll sideways inside its container. Targets meet 2.5.8 (24 px or
   spacing). How the lists are laid out on a phone (a table or stacked rows)
   is decided after the desktop is finished, as an amendment to this ADR or
   a new one, and checked at 320 and 390 px.
2. **Every state designed.** Loading, empty (never used / no match, with a
   way out), error (what happened, what to do, a retry), signed out, and
   not found, each in Turkish copy from the strings module (ADR-0033).
   Loading skeletons mirror the table's own layout (content-only). The
   skeleton appears only after a short delay, so a fast response never
   flashes it; the delay is set from the measured load times. Any shimmer
   stops under `prefers-reduced-motion`.
3. **Status codes.** A not-found page returns a real 404 and an unexpected
   error a 5xx. The private lists use loading skeletons, so their responses
   stream with 200; an API failure shows the error state with a retry and a
   `noindex` page. They are behind login and never crawled, so the status
   matters to no one but monitoring, which reads the API's own records.
4. **System status visible.** The lists show when the hourly pipeline last
   ran successfully ("last checked"), in the owner's time zone, read from
   `marts.fct_job_freshness`. The view reads `staging`, whose view reads
   `ops`, so `marts` is authorized on `staging` and `staging` on `ops`;
   `tm-api`'s grants stay unchanged. Whether this chain is enough is an
   assumption until a query as `tm-api` succeeds on dev. The API
   caches the value for the current clock hour; at the 10 MiB minimum per
   query (ADR-0022) that is expected to bill well under 1% of the monthly
   free tier, to be measured.
5. **Accessibility: WCAG 2.2 AA**, checked on every screen in both themes in
   two ways: Lighthouse (axe-based) for what automation finds, and a short
   manual pass for what it cannot: keyboard only (reachable controls,
   visible focus, logical order, no traps), zoom to 200% and 400%,
   contrast measured with the WCAG formula, and Lighthouse's listed manual
   checks. A clean Lighthouse score is not reported as AA conformance.
6. **Design restraint.** ADR-0034's tokens and fonts stay; no gradients,
   glass, decorative motion, or invented numbers.
7. **No sticky table headers for now.** The table scrolls sideways inside
   an `overflow-x` container, which also traps `position: sticky`, so a
   header that stays visible while the page scrolls needs extra structure;
   with 20 rows per page by default the gain is small. Revisit with the
   mobile layout or larger page sizes.
8. **Table alignment follows the standard** [11][12]: text and dates
   left-aligned, numbers right-aligned, each header aligned like its
   column's content. Every column in the two lists is text or a date, so
   all headers move from centered to left. This replaces the centered
   headers chosen in step 1.10.

Delivered in pull requests: states, freshness, and accessibility on the
desktop first, then the mobile layout. Lighthouse and the manual pass are
run before and after, and the numbers are recorded below.

## Rationale

Alternatives considered:

1. **Polish the desktop only, mobile later without a baseline.** Rejected:
   the CV link makes the phone a likely first screen, and reflow is a WCAG
   AA requirement, not a layout preference. Only the phone layout of the
   lists is deferred.
2. **Correct status codes everywhere, no skeletons.** Rejected for the
   private lists: the first load reaches BigQuery and can take a second or
   two of blank page, while the status code of a page behind login
   affects nothing (point 3).
3. **A UI component library** for states and layout. Rejected: it would
   replace ADR-0034's design system with a library's look, the generic
   look this ADR avoids, for a handful of screens.
4. **Freshness from the marts' last-modified time.** Rejected: it shows when
   data last changed, not when the system last checked (see "Data
   freshness").
5. **Granting `tm-api` read access on `staging` and `ops`.** Rejected: it
   widens the API's access to every row there; an authorized dataset shares
   only what the mart views select.

## Consequences

**Positive:**

- Every failure has a designed, Turkish answer instead of a framework
  default, and the owner can tell "nothing yet", "nothing for this filter",
  and "something broke" apart.
- "Last checked" shows that the system is alive even on days without new
  mail.
- Accessibility is measured in two ways, so a clean automated score is not
  mistaken for conformance; the baseline already shows a failure (reflow at
  400%) that no audit reported.

**Negative / trade-offs:**

- Authorizing `marts` on `staging` and `staging` on `ops` is an
  infrastructure change in both projects, made before the Phase 3 health
  panel that also needs it.
- The private lists keep status 200 on API failure while they stream.
- Until the mobile layout lands, phones and high zoom levels still fail
  reflow.
- Revisit the skeleton delay once production load times are measured, and
  sticky headers with the mobile layout.

## Measurements

### Baseline, before changes (2026-10-13)

Lighthouse 13.4.1 in Chrome DevTools, navigation mode, signed in (every
report's final URL is the requested page, not the login redirect). The web
app ran as a production build (`next start`) on localhost against the local
API and dev data, so network latency to the VM and Cloudflare is not
included; these numbers compare before and after, not production. Dark
theme unless noted; desktop / mobile (Lighthouse's simulated mobile
device and throttling).

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Applications | 100 / 97 | 96 / 96 | 100 / 100 | 90 / 90 |
| Incoming postings | 100 / 99 | 96 / 96 | 100 / 100 | 90 / 90 |
| Login | 100 / 99 | 100 / 100 | 100 / 100 | 90 / 90 |
| Unknown address (404) | 100 / 100 | 97 / 97 | 92 / 92 | 40 / 40 |

Light theme, accessibility only, desktop: applications 96, incoming
postings 96, login 100. No contrast failure in either theme.

Failed audits:

- Lists: `aria-prohibited-attr` — the disabled previous/next step in the
  pagination bar is a `span` with `aria-label` and no role.
- 404: `landmark-one-main` (Next.js's default page has no `main`); a
  console error because the CSP (ADR-0038) blocks the default page's inline
  style. Its SEO failures (`noindex`, status 404) are the intended
  behavior of a not-found page.
- Every page: `meta-description` missing; it matters for the login page,
  whose description appears in link previews.

Automated checks pass while the phone layout is unusable: at Lighthouse's
mobile width the full-width sidebar covers most of the screen, which no
audit reported (observed in the report's screenshot). This is what the
manual pass in point 5 is for.

**Manual pass** (owner, applications page, Chrome on a 1920 px wide
screen, light theme):

- Keyboard only: the tab order follows the layout (navigation, filters,
  table links, pagination) with no trap.
- Zoom 200%: passes; the page scrolls vertically, and only the table
  scrolls sideways inside its container.
- Zoom 400% (about 480 CSS px wide): fails reflow (1.4.10). The page
  itself scrolls sideways, the sidebar takes about half the width, and the
  page title is cut off. The sidebar is fixed to the viewport height
  without its own scrolling: scrolled to the bottom of the page, it still
  shows only its top, so the lower navigation items, the theme toggle, and
  sign out cannot be reached. Fixed in the desktop pull request, since it
  affects anyone zooming on a desktop.

**Load times.** Time to first byte of the list pages with a warm API cache:
330–474 ms (desktop runs). The API's BigQuery calls, timed directly from
the developer machine against dev (`time.perf_counter`, 2026-10-13): the
table metadata call that keys the cache, 339–844 ms (1,423 ms on the first
call, which includes authentication); the application query (53 rows)
1,510–1,931 ms; the postings query (1,072 rows) 1,127–1,334 ms. A cold
cache therefore costs about 1.5–2.5 s before the page can render, in the
range where a skeleton suits (point 2); a warm cache stays under one
second, where none is needed. The skeleton's delay is set between the two
and checked again in production, where the VM is farther from the data
(ADR-0016).

## References

1. [10 Usability Heuristics for User Interface Design — Nielsen Norman Group](https://www.nngroup.com/articles/ten-usability-heuristics/)
2. [Error Messages: 4 Guidelines for Effective Communication — Nielsen Norman Group](https://www.nngroup.com/videos/error-message-communication-guidelines/) (known from the page summary)
3. [Error-Message Guidelines Scoring Rubric — Nielsen Norman Group](https://www.nngroup.com/articles/error-messages-scoring-rubric/) (known from search-result summaries)
4. [Page not found pages — GOV.UK Design System](https://design-system.service.gov.uk/patterns/page-not-found-pages)
5. [There is a problem with the service pages — GOV.UK Design System](https://design-system.service.gov.uk/patterns/problem-with-the-service-pages)
6. [Error pages — The National Archives Design System](https://design-system.nationalarchives.gov.uk/patterns/error-pages/) (known from search-result summaries)
7. [Empty States in Application Design: 3 Guidelines — Nielsen Norman Group](https://www.nngroup.com/videos/empty-states-in-application-design-guidelines/) (known from the page summary and secondary write-ups)
8. [Designing for Empty States — SAP Fiori Design Guidelines](https://www.sap.com/design-system/fiori-design-web/v1-96/foundations/best-practices/global-patterns/designing-for-empty-states) (known from search-result summaries)
9. [Skeleton Screens 101 — Nielsen Norman Group](https://www.nngroup.com/articles/skeleton-screens/)
10. [Refactoring UI — Adam Wathan and Steve Schoger](https://www.refactoringui.com/) (known from secondary summaries, not the book)
11. [Table — Maersk Design System](https://designsystem.maersk.com/components/table/)
12. [Table design: scannability — data.europa.eu Data Visualisation Guide](https://data.europa.eu/apps/data-visualisation-guide/table-design-scannability)
13. [Understanding SC 1.4.10: Reflow — W3C](https://www.w3.org/WAI/WCAG22/Understanding/reflow) (known from search-result summaries)
14. [Understanding SC 2.5.8: Target Size (Minimum) — W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
15. [The WebAIM Million 2026 — summary by Nexer Digital](https://www.nexerdigital.com/news-and-thoughts/the-webaim-million-report-2026-what-it-tells-us) (WebAIM's report itself not read)
16. [What we found when we tested tools on the world's least-accessible webpage — GOV.UK Accessibility blog](https://accessibility.blog.gov.uk/2017/02/24/what-we-found-when-we-tested-tools-on-the-worlds-least-accessible-webpage/)
17. [Automated Testing Study Identifies 57 Percent of Digital Accessibility Issues — Deque](https://www.deque.com/blog/automated-testing-study-identifies-57-percent-of-digital-accessibility-issues) (vendor figure; known from search-result summaries)
18. [Lighthouse accessibility scoring — Chrome for Developers](https://developer.chrome.com/docs/lighthouse/accessibility/scoring)
19. [AI Design Slop: 16 Patterns That Out Your App as Vibe-Coded — Developers Digest](https://www.developersdigest.tech/blog/ai-design-slop-and-how-to-spot-it) (known from search-result summaries)
20. [no-slop-ui — GitHub](https://github.com/LeoStehlik/no-slop-ui) (known from search-result summaries)
21. [loading.js — Next.js 16 docs](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
22. [Authorized views — BigQuery, Google Cloud](https://docs.cloud.google.com/bigquery/docs/authorized-views)
