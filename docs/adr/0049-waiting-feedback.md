# ADR-0049: Waiting Feedback — Instant Selection, a Quiet Pending State, and Loading on Every Route

**Date:** 2026-10-16
**Status:** Accepted (2026-10-16)

## Context

ADR-0048 made every control answer the moment it is pressed, and left
open what a click shows while the next page loads. This ADR takes that
up. The goal is not to make anything faster; the server's time is
unchanged. The goal is that a wait never looks like a click that did
nothing, on any device and connection, and that waiting feels smooth.

Every filter, sort, page, page size, period, and search on the two lists
is a link or a URL change rendered on the server. In Next.js 16.4 a page
keeps its UI state when only the search params change (the router's own
comment in `layout-router.js`), and a navigation is a React transition,
so the old content stays on screen, unchanged, until the new page
arrives. The selected filter also stays where it was until then.

### Measurements (2026-10-16)

Production, signed in as the owner, headless Chrome 155 driven over the
DevTools Protocol from the developer machine. Each scenario starts from
a fresh page load, waits 1.5 s for prefetches to settle, and clicks
through the DOM (`element.click()`), so the pressed state of ADR-0048 is
not part of these numbers. Five runs per scenario; values are the median
in milliseconds, with the range where it matters.

- **First change:** the first DOM change after the click outside `<head>`
  and Next.js's route announcer.
- **Content:** the URL is the target's and no loading skeleton is left.

Three profiles:

- **Desktop:** 1440 × 900, the machine's own connection.
- **Slow 4G:** Lighthouse's mobile network values [1] (150 ms latency,
  1.6 Mbps down, 750 Kbps up) through `Network.emulateNetworkConditions`.
- **Slow phone:** slow 4G, a CPU four times slower [1], 390 × 844 with
  touch.

| Click | Desktop | Slow 4G | Slow phone |
|---|---|---|---|
| Filter, sort, page, page size, status, period: **first change** | 337–381 | 391–443 | 433–484 |
| Same, content | the same | the same | the same |
| Search, from the keystroke (300 ms debounce included): content | 643 | 720 | 750 |
| Sidebar to applications or postings: first change (skeleton) | 13–14 | 12–14 | 65–88 |
| Sidebar to applications or postings: content | 333–362 | 440–504 | 475–577 |
| Sidebar to the health panel: first change | 150–168 | 236–248 | 311–372 |
| Slowest single run | 607 | 958; 2,404 (sidebar) | 1,053; 1,234 (sidebar) |

The ranges in the first rows are the spread of medians across the
scenarios in that row. On the lists, the first change and the content
arrive together in every scenario and profile: for a third to half a
second after the click nothing on screen changes. The period menu
closes in 3 ms (15 ms on the slow phone) and a typed letter shows in
2 ms (10 ms), so work done in the browser itself stays far below 100 ms
even on the slow CPU.

One extra run during a dry run took 6,774 ms from the application list
to the health panel; it did not recur in 15 later runs. A cold API
cache is the likely cause; not verified.

Interruptions, history, and position (5 runs each, desktop / slow phone):

| Scenario | Result |
|---|---|
| Browser back after a filter or page change | Content in 9–21 ms / 19–24 ms: served from the router cache |
| Two filters clicked 100 ms apart | The second wins in 20 of 20 runs; content after 446–451 / 542–550 ms, with nothing changing before |
| Page 2 clicked at the bottom of the list | Nothing changes for 348–384 / 454–469 ms; then the page scrolls to the top (938 / 1,325 px to 0) while focus stays on the page link at the bottom, now off screen |

**Limits of these numbers.** Chrome's network emulation added only about
30 to 100 ms to a static file (130–212 ms unthrottled, 188–305 ms
throttled, 5 fetches each), not the full 150 ms; the slow 4G column is a
lower bound for a slow network. Lighthouse itself defaults to simulated
throttling [1]. Runs from one machine are a lab measurement, not field
data from many users. A real iPhone is still unchecked (ADR-0048).

### Guidance

- **Response limits.** About 0.1 s feels instantaneous; about 1 s keeps
  the flow of thought though the delay is noticed [2]. RAIL: complete the
  response to input within 100 ms, and "for actions that take longer than
  50 ms to complete, always provide feedback" [3].
- **INP** rates an interaction good at 200 ms or less and poor above
  500 ms, at the 75th percentile of real page loads [4]. It runs from the
  input to the next painted frame, whether or not that frame shows a
  change; a click whose frame paints nothing new can score well. The
  first-change measure above is the stricter one for this problem.
- **Progress indicators.** Under about 1 s, a looped animation distracts:
  users "cannot keep up with what happened and might feel anxious about
  whatever flashed on the screen"; looped indicators suit 2 to 10 s [5].
- **Delay and minimum display.** Common practice delays an indicator so
  fast actions never show it, but there is no standard value: Adobe's
  pattern library delays 500 ms [6]; the `spin-delay` library defaults to
  500 ms, and a minimum of 200 ms once shown [7]. Oracle's APEX notes
  that a delay alone is not enough, since a process can end just after
  the indicator appears [8]. Next.js's own example for `useLinkStatus`
  starts its hint invisible and fades it in after a delay [9].
- **Pending state of a link.** `useLinkStatus` reports a `Link`'s pending
  state, true until history updates; it suits dynamic routes without a
  `loading.js`; when several links are clicked in quick succession, only
  the last one is pending; it is skipped when the route was prefetched
  [9]. `useOptimistic` shows a temporary value during a transition, and
  the real value replaces it in one render when the transition ends [10].
- **Focus after client-side changes.** In user testing of client-side
  routing, focusing a heading "was found to be the best experience";
  focusing a wrapper "worked okay"; both were preferred over resetting
  focus to the top [11].
- ADR-0039 point 6 already rules out decorative motion; ADR-0048 rejected
  a ripple.

## Decision

Every timing below is a token in `globals.css`, so the "after"
measurement can tune it in one place.

1. **The choice moves at once.** A clicked filter segment, status,
   period, sort direction, page number, and sidebar or bottom-bar section
   shows as selected immediately (optimistic, `useOptimistic` or the
   link's pending state), not when the server answers. In the segmented
   control the selected background slides to the new segment (about
   150 ms, `transform` only); under reduced motion it jumps.
2. **Waiting is quiet.** While a navigation is pending, the list's
   content dims: invisible for the first 300 ms, then a 200 ms fade to a
   reduced opacity, with no loop and no spinner [5]. A typical
   350–480 ms wait shows at most a slight dimming; a slow one (the
   958 ms and 2.4 s runs) shows it clearly. The dimming disappears the
   moment the content arrives. The 300 / 200 ms pair is a chosen default,
   not a standard [6][7]; the owner accepted it as the starting value.
3. **A loading boundary on every route.** The health panel (and the
   reports page) get a `loading.tsx` like the lists, with the existing
   skeleton delay (`--skeleton-delay`, 600 ms), so a sidebar click
   changes the current section within 100 ms everywhere. How the health
   panel's own sections load and fail is ADR-0050.
4. **The period menu opens with motion.** 150 ms (`--motion-base`) of
   scale and opacity from the button; closing is immediate; none under reduced
   motion.
5. **Motion tokens.** The site's durations come from a few named tokens
   in `globals.css`, so every motion shares one rhythm; the one raw value
   left in a site stylesheet (the theme switch's 160 ms) moves to them.
   The locked pages' mail game keeps its own timings, which are its
   choreography, not the site's rhythm.
6. **The last click wins.** Rapid clicks keep today's behaviour (20 of 20
   runs): the optimistic selection always shows the last click. The web
   app has no unit-test setup, so this is checked by the measurement
   script's rapid-click scenario, before and after (below); adding a web
   test setup is a separate decision.
7. **Back and forward stay instant.** The router cache serves them in
   under 25 ms today; the optimistic state follows the URL, and the
   "after" measurement checks this does not regress.
8. **A page change keeps the viewer in place.** After page 2 is clicked,
   focus moves to the list itself (the table, focusable by script only),
   so the next Tab reaches the first new row, instead of staying on an
   off-screen page link. The tested advice for route changes is a heading
   [11]; a new page of the same list is not a route change, and a heading
   would send the next Tab through the toolbar again. The page number is
   selected at once (point 1) and the rows dim (point 2), so the bottom of
   the page shows the click before the scroll.
9. **Screen readers hear the wait.** The list region carries
   `aria-busy="true"` while a navigation is pending.

**After the change** the same scenarios are measured with the same script
and profiles (below). Target: the first change of every click under
100 ms on all three profiles, back and forward still under 25 ms, the
last click winning in every run.

### After (2026-10-16)

Same script, profiles, and five runs per scenario, against a local
production build (`next start`) of this change that reads the production
API, since the change was not yet deployed. That adds a hop from the
developer machine to the API, so the content times are not comparable
with the baseline; the first change happens in the browser and is. The
first-change measure was made stricter for this run: attributes that
change nothing on screen by themselves (`data-pending`, `aria-busy`) do
not count. The script also checks, two frames after the click, that the
clicked link is already marked current.

| Click: first change | Desktop | Slow 4G | Slow phone |
|---|---|---|---|
| Filter, sort, page, page size, status, period (before: 337–484) | 4–6 | 3–6 | 23–40 |
| Search, the typed letter | 2 | 2 | 13 |
| Sidebar to applications or postings (before: 13–88) | 3–4 | 3–4 | 23–27 |
| Sidebar to the health panel (before: 150–372) | 3–4 | 3–4 | 20–26 |

Medians in milliseconds. The clicked filter, status, period, page
number, or section was current two frames after the click in every run
where the URL had not yet changed (sort links carry no `aria-current`;
their arrow changes instead).

| Scenario | Before | After |
|---|---|---|
| Two filters clicked 100 ms apart | the second wins, 20 of 20 | the second wins, 20 of 20 |
| Browser back, desktop / slow phone | 9–21 / 19–24 ms | 12–16 / 28–31 ms |
| Page 2 clicked at the bottom: focus after | the page link, off screen | the table, 20 of 20 |

Every first change is under 100 ms on every profile. Back on the slow
phone missed the 25 ms target by about 5 ms (medians 28 and 31 ms, slowest
run 73 ms); it is still far below what reads as instant. The dimming and
the menu's motion were looked at by the owner on the local build, not
measured.

## Rationale

Alternatives considered:

1. **A thin progress bar at the top of the page** (as GitHub and YouTube
   draw). Rejected: the eye is on the clicked control, not the top edge;
   points 1 and 2 answer where the click happened.
2. **The skeleton on every list click.** Rejected: replacing data that is
   on screen with placeholders flashes more than today's wait.
3. **A spinner or a pulsing dimming.** Rejected: waits are mostly under
   1 s, where looped animation distracts [5].
4. **Dimming at a fixed threshold with no fade** (for example 500 ms).
   Rejected: the measured medians (about 370 ms on the desktop, 470 ms on
   the slow phone) sit near any such threshold, so the indicator would
   appear just before the content and flicker [8]; a delayed fade grows
   with the wait instead.
5. **Juice as games use it** (sound, shake, particles, counting numbers,
   confetti). Rejected for the site by ADR-0039 point 6; the locked
   pages' mail game keeps its own.
6. **View Transitions for every navigation.** Rejected: a cross-fade on
   every data change slows the reading of a table; only the selected
   segment moves.
7. **Measuring real users (RUM).** Rejected for now: it needs a write
   endpoint for visitor data, against the read-only UI and the
   no-separate-observability rule; the slow profiles stand in for slow
   users.

## Consequences

**Positive:** a click is visible at once on every device and connection,
since the immediate answer happens in the browser; a slow answer says so
quietly; the timings change in one file.

**Negative / trade-offs:**

- Nothing gets faster; the 0.3–0.5 s of server time per list click stays.
  Where that time goes is a separate question (roadmap).
- Optimistic selection adds client components to controls that are server
  links today, which must keep working without JavaScript.
- `useLinkStatus` is skipped for prefetched routes [9]; that the lists'
  same-route links stay pending is an assumption until implemented.
- Revisit the 300 / 200 ms pair and the menu timing with the "after"
  measurement and on a real phone.

## References

1. [Network throttling — Lighthouse docs, GitHub](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md)
2. [Response Times: The 3 Important Limits — Nielsen Norman Group](https://www.nngroup.com/articles/response-times-3-important-limits/)
3. [Measure performance with the RAIL model — web.dev](https://web.dev/articles/rail)
4. [Interaction to Next Paint (INP) — web.dev](https://web.dev/articles/inp)
5. [Progress Indicators Make a Slow System Less Insufferable — Nielsen Norman Group](https://www.nngroup.com/articles/progress-indicators/)
6. [Progress indicator — Adobe Commerce Admin Pattern Library](https://developer.adobe.com/commerce/admin-developer/pattern-library/feedback-to-user/progress-indicator) (known from search-result summaries)
7. [spin-delay README — jsDelivr](https://cdn.jsdelivr.net/npm/spin-delay@2.0.1/README.md) (known from search-result summaries)
8. [apex.util.delayLinger — Oracle APEX documentation](https://docs.oracle.com/en/database/oracle/apex/24.2/aexjs/apex.util.delayLinger.html) (known from search-result summaries)
9. [useLinkStatus — Next.js docs](https://nextjs.org/docs/app/api-reference/functions/use-link-status)
10. [useOptimistic — React docs](https://react.dev/reference/react/useOptimistic)
11. [What we learned from user testing of accessible client-side routing techniques — Gatsby blog](https://www.gatsbyjs.com/blog/2019-07-11-user-testing-accessible-client-routing/)
