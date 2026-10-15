# ADR-0042: List Toolbar — Status Groups, Segmented Filter, Search, Period Menu, and Sorting

**Date:** 2026-10-13
**Status:** Accepted

## Context

The application and incoming-posting lists (step 1.10) filtered with rows
of large pill chips above the table: one row on the application list, two
labelled rows (period, status) on the posting list. A summary ("81 ilan ·
son 7 gün") and a sort note ("son gelişmeye göre sıralı") sat at the far
right of the title. Reviewed on 2026-10-13, the owner found the area poor;
the problems found:

1. The options are mutually exclusive, but pills read as independent tags.
2. The selected pill (inverted fill) was the strongest element on the
   page, and every option was a bordered, bold box.
3. The filters floated above the table instead of belonging to it.
4. Period (a time range) and status (a category) looked the same.
5. Summary and sort note were detached from what they describe.
6. Counts had the same weight as their labels.
7. The application groups did not add up: "İlerleme 2, Sessiz 12, Ret 4"
   of 53. On dev data (2026-10-13): open and waiting 11 (10 of them
   silent), open in progress 2, rejected 4, closed without reply
   (ADR-0027) 36; "Sessiz" was a subset of waiting, and closed
   applications appeared in no group.

Guidance read on 2026-10-13:

- **Segmented control** [1]: picks "one choice from a linear set of closely
  related choices"; for filtering, "there should be a segment that shows
  the full list"; 2 to 5 text choices; segments that change the URL are
  rendered as links.
- **Table toolbar** [2]: a table's global controls (search, filters,
  settings) sit in a toolbar on the table; sorting is shown in the column
  header, with an arrow on the sorted column only.
- **Tabs** [3]: highlight the selection with at least two cues, and keep
  the control close to the content it controls.
- **Filter patterns** [4][5]: show the active filters, offer a way to clear
  them, and show how many items match.
- Owner-supplied examples (an analytics dashboard, a data catalog, an
  incident tool) used compact controls on the table or panel, preset time
  ranges in a menu, and a "clear" link.

## Decision

1. **Status groups that partition the list.** Applications: Tümü, Yanıt
   bekleniyor (applied, open), İlerleme (in progress, open), Ret, Yanıtsız
   kapandı (closed without reply). The four groups do not overlap and add
   up to the total. Silence stays a badge in the row, not a group.
   Postings keep their groups (Tümü, Yeni, Kaydedilen, Başvurulan).
2. **A segmented control with counters** for the status, as links (the
   choice stays in the URL). The selected segment is raised onto the
   surface with stronger text; counts are small gray counters.
3. **A toolbar inside the list panel**, above the column headers. Filters
   on the left: the status segments and, on the posting list, the period
   menu next to them. On the right: "Filtreleri temizle" when the filters
   differ from the defaults, and the search, which takes the remaining
   width up to a cap.
4. **The period menu is the app's own**, not a native select, whose open
   list the browser draws and CSS cannot style: a button showing the
   period with a clock icon opens a list of links (WAI-ARIA disclosure
   navigation [6]) with a check on the current one ("Son 7 gün", "Son 30
   gün", "Tüm zamanlar"). It closes on Escape, a click outside, or focus
   leaving it.
5. **Sortable date columns**: "Başvuru" and "Son gelişme" (applications),
   "Geliş" and "Son görülme" (postings). A sortable header is a link;
   clicking the sorted column flips its order, another column sorts by it,
   newest first. The sorted column shows its arrow and `aria-sort`; the
   others show theirs on hover or focus [2]. The sort is in the URL
   (`sort`, `order`); applications are sorted in the web server, postings
   in the API, and a missing application date sorts last. The title row
   keeps only the title; the item count is in the pagination bar.
6. A no-match message sits inside the panel under the toolbar, so the
   filters stay in place; empty and unavailable states keep their own
   panel.
7. **Free-text search** on both lists, at the right end of the toolbar: one
   field with a magnifier that searches as the owner types, 300 ms after
   the last keystroke, and at once on Enter. The query is in the URL as `q`
   (the history entry is replaced, not added per keystroke), and without
   JavaScript the field is a plain GET form. It matches title and
   company, ignoring case and Turkish letters (accents dropped, dotted and
   dotless i equal, so "basvuru" finds "Başvuru" and "ai" finds "AI"), and
   every word must appear. Segment counts are counted within the search.
   Applications are searched in the web server, which already holds the
   whole list; postings in the API, where their filtering and paging live
   (`q`, at most 100 characters). The two folding rules are kept in step;
   on 2026-10-13 both gave the same output on the same eight samples.
8. **One tone per panel.** Toolbar, column headers, rows, and pagination
   share the panel surface and are separated by lines; only the segmented
   control's track is recessed. Alternating fills made the panel read as
   stripes.

## Rationale

1. **Keep the chips, restyled.** Rejected: the component itself implies
   independent options (problem 1).
2. **A second segmented control for the period.** Rejected by the owner:
   a menu keeps the toolbar light and makes the two kinds of filter look
   different.
3. **Three groups (waiting, in progress, rejected).** Rejected: 36 of 53
   applications would be in none; counting closed applications as waiting
   would call them waiting when they are not.
4. **A date-range picker.** Rejected: the periods are fixed presets.
5. **Search on Enter only.** Tried first; the owner asked for search as
   you type. The pause keeps it to about one request per typed word.
6. **A styled native select.** Rejected: only the closed control can be
   styled with the CSS used here; the newer customizable select
   (`appearance: base-select`) was not evaluated, and its browser support
   was not checked.

## Consequences

**Positive:**

- The page leads with the data; the filters read as part of the table.
- Every application belongs to exactly one group, so the counts add up.

**Negative / trade-offs:**

- Links to the old "silent" filter (`?filter=silent`) now open the full
  list; silent applications are found by their badge.
- Five segments fit a desktop toolbar; on a phone they wrap, which the
  mobile layout (ADR-0039) revisits.

**Note, 2026-10-16:** the posting list is sorted by "Son görülme" by default, and phones get their own toolbar and a summary line with the sort ([ADR-0047](0047-mobile-layout.md)).

## References

1. [SegmentedControl guidelines — GitHub Primer](https://primer.style/product/components/segmented-control/guidelines/)
2. [Data table usage — Carbon Design System](https://carbondesignsystem.com/components/data-table/usage/)
3. [Tabs, Used Right — Nielsen Norman Group](https://www.nngroup.com/articles/tabs-used-right/)
4. [Filtering — Pleo Telescope design system](https://telescope.pleo.io/patterns/filtering/filtering.about) (known from search-result summaries)
5. [Search filters — Australian Government Agriculture design system](https://design-system.agriculture.gov.au/patterns/search-filters) (known from search-result summaries)
6. [Disclosure (Show/Hide) Pattern — W3C WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
