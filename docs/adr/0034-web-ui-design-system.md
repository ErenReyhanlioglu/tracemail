# ADR-0034: Web UI Design System — Mockup Tokens, Semantic Status Colors, Light and Dark Themes

**Date:** 2026-10-11
**Status:** Accepted

## Context

Step 1.10 builds the first screen of the web app: login and the owner's
application list. The owner asked that the UI must not look generated or
careless, that status colors follow established conventions with one
meaning per color and a visible hierarchy, and that light and dark themes
both exist. The mockups (`docs/interface_concept/`) define layout, fonts,
and base colors for a light theme only; CLAUDE.md lists their tokens.

Findings from current sources:

- **Status color meanings.** IBM Carbon: red for danger or error, orange
  for serious warnings, yellow for regular warnings, green for success, blue
  for passive notifications and workflow progress, purple for outliers, and
  gray for drafts or work not yet started. It groups statuses by high,
  medium, and low attention, warns that more than five or six indicators
  overwhelm, and recommends plain text instead of an indicator when no
  action is needed [1]. Atlassian's lozenge uses the same scheme: default
  (gray) for "to do" and "not started", success (green) for "completed" and
  "approved", removed (red) for "declined" and "failed", plus an in-progress
  appearance [2][3].
- **Never color alone.** WCAG 1.4.1 forbids color as the only carrier of
  information. Primer and Atlassian require label text that is meaningful on
  its own [3][4]. Text needs 4.5:1 contrast (WCAG 1.4.3); state-bearing
  non-text parts need 3:1 (WCAG 1.4.11) [5].
- **Generated-UI tells.** Practitioner write-ups list Inter everywhere,
  purple-to-blue gradients and glows, emoji icons, repeated identical stat
  cards, uniform default spacing, and stock UI-kit colors. The common fix is
  a deliberate design system derived from a reference design, followed
  strictly [6][7][8]. These are practitioner opinions, not standards.
- **Toolchain.** Next.js 16.4.0 is current (released 2026-10-06) [9]. It
  supports TypeScript 7 only behind `experimental.useTypeScriptCli`; its
  default checker uses the TypeScript 6 API [10].

## Decision

1. **Reference design.** The mockups are the only visual reference. All
   colors, font sizes, spacing (4 px base), radii, and borders are CSS custom
   properties defined once; components use tokens, never raw values. Fonts:
   IBM Plex Sans for text, IBM Plex Mono for dates, counts, and channels,
   self-hosted at build time through `next/font`.
2. **Status badges**, highest attention first. Every badge carries its own
   meaningful text:

   | Data | Meaning | Color | Label |
   |---|---|---|---|
   | `is_silent` | action suggested | amber (warning) | "N gündür sessiz" |
   | `rejected` | declined | red | "Ret" |
   | `in_progress` | workflow progress | blue | "İlerleme" |
   | `applied` | waiting | gray | "Yanıt bekleniyor" |
   | `is_closed_without_reply` | no action | no badge; plain mono text "yanıtsız kapandı", muted card | — |

   Green means success only and is not used in the list yet. The silent
   badge shows the day count, so the owner sees how long the silence is. The
   mockup's green "İlerleme" becomes blue to follow the convention.
3. **Themes.** Light and dark, both designed. The default follows the
   operating system (`prefers-color-scheme`). A toggle overrides it, and the
   choice is stored in a cookie so the server renders the right theme
   without a flash. Every badge and text pair meets 4.5:1 in both themes,
   checked when implemented.
4. **Desktop layout only** for now; a phone layout is added when the owner
   asks for it.
5. **Stack.** Next.js 16 App Router, React 19, TypeScript 6 (`strict`),
   CSS Modules with custom properties, no UI kit and no CSS framework.
   Private data is fetched in server components with the session cookie
   forwarded (CLAUDE.md, Frontend). Client components are limited to
   browser-only controls: the theme toggle, sign-out, and the rows-per-page
   selector.

## Implementation notes

Verified 2026-10-11 against dev data, screenshots in both themes at 1920 and
1366 px, owner-reviewed:

- **Lists are tables, not cards.** Every application has the same fields,
  so each gets one column; cards with label/value pairs read as scattered.
  Columns have fixed, owner-chosen widths; the first takes the rest. Cells
  never wrap (ellipsis, full text on hover), so every row has one height;
  below the minimum width the table scrolls sideways.
- **User-resizable columns were tried and removed.** A hand-written version
  overflowed and squeezed columns; a TanStack Table version worked but the
  owner judged the feature not worth its complexity.
- **Pagination** is a bar attached to the table, always shown: rows per page
  (10/20/50) and the item range on the left, previous/next and page links
  on the right (Carbon's pagination anatomy [11]); page links are truncated
  with GitHub Primer's defaults, one page at each end and two around the
  current one [12]. Page, size, and filter live in the URL.
- **Contrast** measured with the WCAG formula: lowest text pair 4.8:1,
  badges at least 6.7:1, in both themes.

## Rationale

1. **Keep the mockup's green for progress.** Rejected: green means success
   in every system checked; progress is blue.
2. **A gray badge for closed applications too.** Rejected: two grays carry
   no distinction; Carbon recommends plain text when no action is needed.
3. **A UI kit or Tailwind.** Rejected: the design is small and fixed by the
   mockups; stock defaults are one of the tells to avoid.
4. **TypeScript 7.** Deferred: it needs an experimental Next.js flag and
   prints diagnostics without Next.js context; revisit when it becomes the
   default checker.
5. **Light theme only.** Rejected by the owner.

## Consequences

**Positive:**

- One meaning per color, and the only loud badge is the one asking for
  action.
- A token change restyles everything consistently.

**Negative / trade-offs:**

- The dark theme and the phone layout have no mockup; they are designed
  here and approved from screenshots.
- Revisit the status set when Phase 2 adds reply classification or an
  "offer" outcome (the first use of green).

## References

1. [Status indicator pattern — Carbon Design System](https://www.carbondesignsystem.com/patterns/status-indicator-pattern)
2. [Lozenge — Atlassian Forge UI Kit](https://developer.atlassian.com/platform/forge/ui-kit/components/lozenge/)
3. [Lozenge usage — Atlassian Design System](https://atlassian.design/components/lozenge/usage)
4. [Label accessibility — GitHub Primer](https://primer.style/product/components/label/accessibility)
5. [Understanding SC 1.4.11 Non-text Contrast — W3C WAI](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast)
6. [7 Signs a UI Has Been Vibe Coded — The Fountain Institute](https://www.thefountaininstitute.com/blog/signs-vibe-coded-ui) (known from search-result summaries)
7. [How to de-slopify your designs — UX Collective](https://uxdesign.cc/how-to-de-slopify-your-designs-4c40c57c1dc9) (known from search-result summaries)
8. [How to avoid that vibe-coded look — Robots on Payroll](https://robotsonpayroll.substack.com/p/how-to-avoid-that-vibe-coded-look) (known from search-result summaries)
9. [next — npm](https://www.npmjs.com/package/next) (release metadata read through the npm registry)
10. [TypeScript configuration — Next.js docs](https://nextjs.org/docs/app/api-reference/config/typescript) (known from search-result summaries)
11. [Pagination usage — Carbon Design System](https://carbondesignsystem.com/components/pagination/usage/)
12. [Pagination — GitHub Primer](https://primer.style/product/components/pagination)
