# ADR-0050: Health Panel Sections Load and Fail Independently

**Date:** 2026-10-16
**Status:** Accepted (2026-10-16); point 4 open

## Context

The health panel is the only public page and where every visitor lands
(ADR-0040). Its measurements came from one endpoint,
`/api/v1/public/health-panel`, which ran three BigQuery queries one
after another and cached the result for a half-hour window (ADR-0044):

| Query | Sections it feeds | If it failed |
|---|---|---|
| Run history | Status line, stages, history strips, most resources | The whole measurement area was replaced by "data unavailable" and a retry |
| Storage metadata | The storage rows of resources | The same: the whole area went |
| Delivery | Delivery (DORA) | Only that section was empty (since the 2026-10-14 incident) |

The page waited for the whole response before it rendered anything, and
it had no loading boundary (ADR-0049 point 3). The incident list, which
needs no query, sat in the same block and disappeared with it.

**Measured on production** (2026-10-16, `curl` time to first byte from the
developer machine, the first request of a cache window): 9.72 s at 17:13
UTC and 8.85 s at 18:06 UTC; the next requests of each window took
0.34 to 0.38 s. A sample at 17:36 found the cache already warm, filled by
ADR-0049's measurements, and is not counted. A dry run of ADR-0049's
script saw 6.8 s on the same path. With little traffic, the first visitor
of most windows is likely to meet the cold path; how often is an
assumption.

**Measured per query** (2026-10-16, the local API against dev data, the
first request after start, so authentication is included): run records
8.8 s, storage 2.2 s, delivery 2.4 s. The run-records query is the slow
one; reading the three at once makes a cold page wait about as long as
that query alone.

About 10 s is the limit for keeping a user's attention on the task [1].
A skeleton makes a wait of a second or two acceptable [2]; it does not
make ten seconds acceptable.

Every part is read from BigQuery, so some failures take all three down
(BigQuery itself, the API's credentials, the API being down) and some
only one (a missing view, as in the 2026-10-14 incident, a query over
its byte cap, a dataset without the grant).

## Decision

1. **Static parts show at once.** The introduction and the incident list
   need no query and render with the page shell.
2. **Each query group loads on its own.** The three groups above are
   three public endpoints, `/api/v1/public/health-panel/runs`,
   `/storage`, and `/delivery`, each with its own whitelisted schema, its
   own cache entry per window, and its own place in the privacy test. The
   page wraps each group in its own `Suspense` boundary with a skeleton
   in the shape of its sections (content-only, ADR-0039) at the block's
   measured height and with the existing skeleton delay, so groups
   appear as their data arrives. The web server requests the three at
   once. The route's `loading.tsx` shows the same skeletons.
3. **Each group fails on its own.** A group BigQuery cannot answer gets a
   503 from the API; the log names the group and the error type only,
   and the cache keeps no value, so the next request reads it again. In
   place of its sections the page shows a failure card, after the
   owner's design: a warning icon, what failed, a countdown to an
   automatic retry, and a retry button.
   - **What failed** is said only as far as the web can tell, and
     briefly: no answer from the API ("Sunucuya şu an ulaşılamıyor"), a
     503 ("Veri ambarı şu an yanıt vermiyor"), a 429 ("Kısa sürede çok
     fazla istek geldi"), anything else ("Veriler şu an alınamıyor"). The
     API sends no finer reason, by design; telling a missing view from an
     outage would need one for little gain to a visitor.
   - **Every card retries on its own**: its own 30-second countdown and
     its own button, and the browser asks the API for that part only
     (the parts are public, so the browser may ask for them; private data
     is never fetched from the browser). A card's retry never moves
     another card. The lists, which have one card, retry by fetching the
     page's server data again.
   - No "last successful update" line: while a part fails, the web has
     no such time to show.

Open until the cold path is measured on production after points 1 to 3:

4. **The cold wait itself.** The per-query numbers above suggest about
   9 s cold even with the parts read at once; if production confirms
   more than about 2 to 3 s, one of these is chosen and recorded here:
   - **Refresh on a schedule:** the API reads each window as it starts,
     whether or not anyone visits, so no visitor waits and the data is
     at most one window old. It costs BigQuery reads every window
     (estimate to be measured against the free tier, ADR-0036).
   - **Make the run-records query faster:** find where its 8.8 s go
     before choosing.
   - **Serve the last value and refresh behind it** (stale-while-
     revalidate): no extra reads, but with little traffic the value
     shown has no upper bound on its age. Kept as an option only, at the
     owner's request.

**Verified** on a local production build against the local API, through
a proxy that delays answers and fails chosen parts: each of the four
failure titles shows for its cause; with all three parts failing, three
cards count down on their own; pressing the delivery card's button made
only that card retry, delivery's sections replaced its card when the
answer came, and the other two cards kept counting. API tests cover the
503, the log line, and the re-read after a failure.

## Rationale

Alternatives considered:

1. **One endpoint, each section nullable** (the pattern delivery used).
   Isolates failures without new endpoints, but the page still waits
   for the slowest query before showing anything.
2. **One endpoint per visual section.** More endpoints than queries:
   sections that share a query would read it twice, and each read is
   billed at least the 10 MiB minimum (ADR-0044).
3. **A page-level skeleton only.** Covers the wait but neither the
   failure of one query nor the ten-second cold path.
4. **One shared countdown and retry for the page.** Tried first: one
   button put every card into "retrying", and a retry fetched the whole
   page again, so a part could recover through another part's button.
   Rejected by the owner as confusing.
5. **Naming a third-party service in the message** (as in the design's
   placeholder text, "GitHub Actions"). The panel never calls GitHub
   while it renders; delivery data is copied hourly, so a GitHub outage
   makes it older, not unavailable.

## Consequences

**Positive:** one failing query no longer takes the public page down;
the page shows its frame and static parts at once; a failed part recovers
by itself, or by its own button, without reloading the page. BigQuery
reads stay the same three queries per window.

**Negative / trade-offs:**

- Three public endpoints instead of one, each needing the privacy test
  and rate limiting. The web server forwards each visitor's
  `CF-Connecting-IP`, so the limiter counts per visitor; a page view now
  counts three requests, and each card retry one, against the limit of
  60 per minute, which still allows about 20 page views a minute, so it
  stays.
- The health panel's section components now also run in the browser,
  for a part that recovers there.
- A failed part is read from BigQuery again on every retry while it
  fails (the cache keeps no failure), at most once per card per
  30 seconds.
- When the run records recover in the browser, the "read at" line at
  the foot of the page appears only on the next page load.
- ADR-0044's single response shape changed; the web types follow.

## References

1. [Response Times: The 3 Important Limits — Nielsen Norman Group](https://www.nngroup.com/articles/response-times-3-important-limits/)
2. [Skeleton Screens 101 — Nielsen Norman Group](https://www.nngroup.com/articles/skeleton-screens/)
