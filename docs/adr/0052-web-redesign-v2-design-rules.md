# ADR-0052: Web Redesign v2 — One Color per Meaning, Layered Surfaces, Mono for Metadata

**Date:** 2026-11-11
**Status:** Accepted

## Context

The owner made a second set of mockups (kept out of the repository: they
are drawn over the owner's real applications and postings, which never
enter it; `docs/interface_concept/v2/` is ignored): a
grouped sidebar with counts and quick views, underlined list tabs, a
freshness pill, numbered pagination, a reworked health panel layout, and a
phone menu sheet. With them came written design rules for color and type.

The mockups use two sets of status colors: the lists draw green `#5CC98A`,
red `#EF7D7D`, and amber `#F0B455`; the health panel draws green `#45A882`,
red `#D9776B`, and amber `#D9A253`. The health panel's green and red have
the same relative luminance (measured: 0.309 and 0.290). The mockups and the
written rules cover the dark theme only; the app has both (ADR-0034).

The rules are proposed here and refined from the owner's review on local
before they are accepted. The screen changes (sidebar, lists, health
panel, phone menu) are implemented one at a time on top of these rules.

## Decision

1. **Colors are written once.** Every color value lives in `globals.css` as
   a `light-dark()` pair. Components refer only to these names. Ranges in
   the written rules become one value each.

   | Role | Name | Dark | Light |
   |---|---|---|---|
   | App ground and sidebar | `--color-page` | `#0B0D10` | `#F3F4F6` |
   | Table header band, filled areas | `--color-band` | `#0E1115` | `#F8F9FA` |
   | Content panel | `--color-surface` | `#111419` | `#FFFFFF` |
   | Secondary surfaces, hover | `--color-raised` | `#14181D` | `#F1F3F5` |
   | Active menu item | `--color-active` | `#171B21` | `#E8EBEF` |
   | Primary text | `--color-text` | `#E9ECF1` | `#14181F` |
   | Secondary text | `--color-text-secondary` | `#C9D0DA` | `#2F3742` |
   | Tertiary text | `--color-text-tertiary` | `#9AA3AF` | `#4B5563` |
   | Metadata | `--color-text-meta` | `#8A93A0` | `#57606C` |
   | Labels | `--color-text-label` | `#7C8593` | `#5F6874` |
   | Panel and section edges | `--color-border` | `#1F232A` | `#E3E6EB` |
   | Table rows | `--color-rule` | `#1B1F26` | `#ECEEF1` |
   | Control outlines | `--color-control-border` | `#262B33` | `#D5D9DF` |
   | Accent | `--color-accent` | `#7AA2FF` | `#1F4FD8` |

2. **One accent, used sparingly:** the active item's icon, the active tab's
   underline and count, the "new" badge, the logo's dot, and links. Never a
   large fill: the active sidebar item and the phone's active tab use
   `--color-active` with the accent on the icon only. The light theme keeps
   the existing `#1F4FD8`, since `#7AA2FF` on white measures 2.49:1.

3. **One color per meaning**, from the health panel's balanced set:

   | Meaning | Base (dots, cells) | Colored text | Dark (both) | Light base / text |
   |---|---|---|---|---|
   | Fine, running | `--color-ok` | `--color-ok-text` | `#45A882` | `#2F8F6E` / `#0B6B57` |
   | Error, rejection | `--color-error` | `--color-error-text` | `#D9776B` | `#C8604F` / `#9B1C1C` |
   | Progress, delay | `--color-attention` | `--color-attention-text` | `#D9A253` | `#B8801F` / `#7A4300` |
   | New (postings) | `--color-accent` | `--color-accent` | `#7AA2FF` | `#1F4FD8` |
   | Waiting | hollow ring in `--color-text-meta` | `--color-text-secondary` | — | — |

   In dark, colored text is the base itself (at least 5.05:1 on its tint).
   In light the base is too light for text on white (about 4:1), so text
   takes a darker shade. A status dot carries the meaning; its label stays
   in plain text (`--color-text-secondary`). A posting is new (accent),
   saved (amber, a step taken), or applied (green). A first pass used pale
   tints (`#C3EBD2`, `#F6C4C4`, `#F3DDB3`) as dark text colors; on plain
   surfaces they read as washed out (owner's review), so they were dropped.

   Status cells and strips (the health panel, the standalone pages) take a
   set of their own (`--cell-ok`, `--cell-late`, `--cell-failed`,
   `--cell-hatch`): the base colors in dark, and in light a softer, less
   saturated set (#5FA88B, #C4913C, #D4806F), since a run of solid red
   cells on white weighed far more than on the dark card and crushed the
   page (owner's review). Measured about 2.5:1 against their block, below
   WCAG 1.4.11's 3:1 [2], which binds only where the graphic alone carries
   the meaning; every strip has a text summary for screen readers and
   every row its numbers. The no-record hatch darkens in light (#A9B0BA,
   1.97:1 from 1.48:1) so it shows at all. Dots, badges, and text keep the
   base colors.

   A badge is its base color's tint (`--tint`, 10%), an edge in the base
   color (`--edge`, 30%), and its text color; tints are mixed with
   `color-mix()` [3] instead of being written as more values. This changes
   ADR-0034's point 2: progress was blue and is now amber, the same as
   delay.

4. **Two fonts with separate jobs.** IBM Plex Sans for interface text; IBM
   Plex Mono only for metadata: dates, counts, durations, versions, column
   headers, sidebar section labels, and the logo. Sizes: page title 26 px
   (22 px on phones), section title 15 px bold, row title 14 px medium,
   secondary text 13 px, mono metadata 12 px. Column headers: mono, 11 px,
   upper case, 0.06 em tracking. Sidebar section labels: mono, 10.5 px,
   upper case, 0.08 em tracking. Sizes are role tokens (`--text-title`,
   `--text-section`, `--text-column`, `--text-nav-label`) beside the
   existing 12, 13, and 14 px steps. Upper case comes from
   `text-transform` under `lang="tr"`, so "i" capitalizes to "İ". Applied
   to page and section titles, both tables' column headers, list row
   titles, and list dates; the sidebar's labels come with the sidebar.

5. **The sidebar is grouped** (amends ADR-0041's flat list). The overview
   stands alone; then Takip (postings, applications, reports), Görünümler,
   Sistem (health panel), and Geliştiren, each under a mono label; the
   width grows from 16 rem to 17 rem (a first 14.5 rem read as cramped on
   a wide screen, owner's review).
   - *Counts.* Applications show their total, as the list's "all" tab
     does. Postings show only the new ones first seen in the last 30 days:
     what still waits to be read, not an ever-growing total (owner's
     review). They come from the existing list
     endpoints, which the API already caches per mart change; no new
     endpoint. Each loader runs once per request (React `cache`), so the
     applications page and its sidebar share one fetch, and each count
     streams in through `Suspense`, so the sidebar never waits for it.
     When the API cannot answer, the count is left out.
   - *Quick views.* İlerleyenler, Yanıt bekleyenler, Kaydedilen ilanlar,
     and Ret alınanlar open a list on one status group, with its count and
     the group's status dot; the saved view spans every period so it
     matches its count. A view is never shown as current; its list's
     section is.
   - *Visitors* get the same rows with a lock in place of every count; no
     private endpoint is called, as the access rules require.
   - *Health dot.* The health panel's row carries the system's state as a
     dot, read from the same public part as the panel and computed by the
     same function as the panel's status line, so the two never disagree.
     It wears a 3 px halo of its own color at 18%, as in the mockup, so it
     reads as a live signal rather than a list dot.
   - *Developer links* (GitHub, LinkedIn, portfolio) open in a new tab
     with `rel="noopener noreferrer"`. GitHub and LinkedIn show their
     filled logos, as in the mockup; outline versions read as foreign
     (owner's review).
   - *Foot.* The viewer's identity and the theme switch on one row, then a
     full-width sign-out button; a visitor's sign-in button carries the
     accent on its edge and text only. A visitor's avatar is the eye in a
     dashed ring with no fill, where the owner's is filled with initials:
     no one is signed in.

   On phones (owner's mockup) the top bar's theme and sign-out icons give
   way to one menu button, whose sheet rises from the bottom over a dimmed
   page: the viewer and the theme switch, the quick views (counts for the
   owner, locks for a visitor), the developer links, and signing out or
   in, in the sidebar's own rows at the 44 px touch target. It is a modal
   `<dialog>`, so focus stays inside and Escape closes it; a tap on the
   dimmed page or on a link closes it too. Verified in headless Chrome at
   390 px: it opens, shows the rows, and closes on Escape. Matched to the
   mockup on review: the raised tone with an upward shadow, 18 px top
   corners, a 12 px inset, a 40 px avatar and 15 px name, touching 44 px
   rows with 10 px corners, and a 44 px button on the card's tone. The
   phone's bottom bar carries the sidebar's live parts as notification
   marks on its icons' top right: the owner's counts for postings and
   applications as accent badges, in full, the bar grown from 64 to 72 px
   so they have room above the icons, and the health dot, haloed, for
   everyone; a visitor's locked
   icons keep their lock. The collapsed sidebar (tablets) no longer hides
   its counts: each is a small mark on its icon's top right, a quiet pill
   with a mono figure in full (the active section's in the accent), and
   the health
   dot a haloed mark there too, so the icons keep one centred column; the
   column widens from 72 to 88 px for three-digit counts, and the views'
   dots grow from 7 to 10 px, near an icon's weight. Two passes came first
   on review: accent-filled badges read as heavy, and counts beside the
   icons pushed them out of line.

6. **One content card on wide screens.** The sidebar is the app's ground
   itself, with no edge line; the content is a single card beside it
   (`--color-surface`, `--color-border`, 12 px corners), inset 8 px from
   the screen's top, right, and bottom and flush against the sidebar, as
   in the mockup. The card fills the screen's height and scrolls inside
   itself. A list fills its card edge to edge (`AppShell flush`), so the
   list panel loses its own frame; the health panel and the locked pages
   keep their padding inside it. Phones keep the earlier layout: no card,
   the page scrolls (ADR-0047). They do take the card's tone, though: the
   content stands on `--color-surface` between the top and bottom bars on
   the app's ground, and the health panel's blocks are the same raised,
   edgeless blocks as on wide screens; with the darker page ground and
   bordered cards, phones read a shade darker than the rest (owner's
   review). Section headings and legends follow the rows' inset (16 or
   20 px), measured equal in headless Chrome at 390 and 600 px.

7. **Lists keep their frame on wide screens.** The tabs, the column headers,
   and the pagination bar stay in place; only the rows scroll. On phones
   the whole page scrolls as before (ADR-0047), since a fixed footer would
   take room the rows need. The card, the list panel, and its body are a
   flex column of the card's height; the table's own scroller takes the
   free height and its header is `position: sticky`, drawn with an inset
   shadow instead of a border, since a collapsed border stays behind when a
   sticky cell moves. Each table is keyed by the list's address, so a new
   page or filter starts at the top of the rows. The postings table's
   columns other than the first are shares of the table (17, 10, 14, and
   14%) instead of fixed widths: in the full-width card the first column
   took all the extra room and pressed the rest to the right (owner's
   review).

8. **List toolbar on wide screens.** The status filter becomes underlined
   tabs (amends ADR-0042's segmented control): no track or boxes, the
   selected tab in primary text with an accent count and a 2 px accent
   line on the toolbar's bottom edge, which slides to a clicked tab as the
   segment background did (ADR-0049). The toolbar is 64 px high. The period
   menu is a quiet button (clock, label, chevron) with no edge or fill;
   it no longer turns accent when a period narrows the list, since the
   accent is kept for the selected tab. Away from the default period
   (the last 7 days) the menu is marked as the selected tab is, with
   primary text and the accent line on the toolbar's edge, and a cross
   beside it returns to the default (a tinted accent chip was tried first
   and read as too loud, owner's review). Like the tabs, it is judged from
   the period being shown, so a click marks it at once; the line grows
   from the middle over `--motion-base` and shrinks back on return, and
   the cross fades in; the "clear filters" link is gone from wide
   screens, since the period was the one filter it had to undo that had
   no control of its own (tabs are one click, the search has its own
   clearing). Phones now take the same tabs (owner's mockup), in a
   sideways-scrolling row at the top whose edges keep their fade, the
   period menu after a short hairline with the same underline and cross,
   and the filled search under the row; the chips, the accent period
   chip, and their tokens are gone. With a mouse (a narrow desktop
   window), the wheel scrolls the row sideways while it can and a drag
   moves it, a drag not counting as a click; touch keeps its own swipe.
   The edge fades sit above the tabs, which are positioned for their
   underline and had covered the left fade. While the tabs fit the row they spread
   across it, edge to edge on the gutter; once they do not, they keep
   their widths and the row scrolls with its fades. The clear link stays in the phones'
   summary line (ADR-0047).

9. **Company monograms.** Each list row starts with a 40 px tile holding
   the company's initial (Turkish capitalization). Its hue comes from the
   name with the mockup's own hash (`h = (h × 31 + code) mod 360`), so a
   company keeps its color everywhere and a list reads as varied without
   random values. Saturation and lightness are fixed per theme: the
   mockup's recipe in dark (letter at least 7.17:1 on its tile over all
   360 hues), and in light a pale tile with a dark letter, whose lightness
   was lowered from 32% to 30% because yellow hues fell to 4.36:1 (now at
   least 4.84:1). The hue is a per-row `style` property, which the CSP
   already allows for attributes (ADR-0038). Not on phones (ADR-0047).
   The mockup's 32 px tile with a 12 px letter read as too small on the
   owner's screen; the tile is 40 px with a 14 px letter. A row without a known
   company gets one fixed grey tile with a question mark, never a hue.

10. **A posting's last sighting on one line.** The date, then a bell and
    the number of alert mails that carried the posting (the mockup's
    separate "Uyarı" column, folded into this one); from 3 alerts the
    count is in primary, semibold text, as in the mockup. Screen readers
    hear "N uyarıda". On phones a posting is a card (owner's review): the
    monogram beside the position over "company · location", and at the
    right the date with the bell and count over the status badge; the
    whole card opens the posting (its link stretched over the row, the
    icon gone), and a posting without an address is not a link. An
    application is the same card, with the last event's date over its
    status badge. An
    application's last event shows only how long ago it was ("3 gün
    önce"), the date on hover; phones keep the date.

11. **One badge per status** (amends ADR-0034 point 2). Every status in
    both lists is one pill: a dot, the label, the tone's tint and edge.
    Postings: Yeni (accent), Kaydedildi (amber), Başvuruldu with its date
    (green). Applications: İlerleme (amber), Ret (red), Yanıtsız (a grey
    pill, tinted and edged in the metadata grey like the colored tones,
    with a hollow ring; a plain pill with only the control edge did not
    read as a pill on the card, owner's review), and Kapandı (the same
    pill in the label grey, without a dot, where it was plain text; text
    at least 5.32:1). An application's silence is no longer a badge of
    its own: its "N+" days ride inside the status badge after a middle
    dot, in the attention color, so a waiting application that needs a
    follow-up still stands out; screen readers hear "N gündür sessiz".

12. **Health panel on wide screens.** The title and introduction sit on
    the left with a "Kaynak kodu" button (GitHub mark) at the right; the
    "Mimari kararlar" link is dropped (owner's choice: the repository is
    enough). The status line is a banner in its state's tone (green, amber
    when late or without runs, red on failure) with a haloed dot and a
    rule after the state. It no longer says how long ago the last run was, since
    its clock time is beside it (owner's review); each detail wraps whole
    rather than squeezing. On phones the status is a card instead (owner's
    mockup): the haloed dot and the state on top, with how far a late run
    is past its freshness target ("2 saat gecikme") at the right, then
    three labelled cells (Son çalışma, Kesintisiz, Sürüm) with mono
    values, a dash where there is none; 118 px tall, which its loading
    placeholder now takes. Each section's rows sit on a raised block
    (`--color-raised`, 10 px corners, no edge), since bordered cards read as
    cards inside the content card; headings align with the blocks' inner
    edge. Legends move beside their section's heading; phones keep them
    under the section, where a heading leaves no room (both are rendered,
    one is hidden, so each is read once). A stage's state is the shared
    status badge. The foot splits into the data's source and the time it
    was read. The content card is positioned: text hidden for screen
    readers deep inside it had stretched the page past the card and given
    it a second scrollbar. Phones keep the earlier panel until their own
    review.

    Refined on review: the stage table's columns are 10.5 rem, 8 rem, the
    strip, and 8 rem twice, with 24 px between them (the name column left
    a gap before the state, and the numbers sat cramped at the right).
    Cells follow the mockup: 22 px high, 4 px corners, 4 px apart. The foot reads "Airflow çalışma kayıtları ·
    saatte bir güncellenir" and "Son güncelleme <time> (UTC+3)", without
    the mockup's colon, as UI copy uses only periods and commas. The
    30-day and delivery blocks take the mockup's sizes: a 30-day score at
    22 px and a delivery measure at 20 px, both mono and semibold
    (`--text-score`, `--text-measure`); names in medium weight, their
    notes and the windows' captions a step smaller; the 30-day strips at
    22 px, the deployments' strip too (the mockup's
    thin 10 px strip read as squashed beside them, owner's review); the deployments table's
    head in the columns' mono capitals. The placeholders that hold each part's
    height while it loads (ADR-0050) were re-measured for this layout on
    2026-11-11, in headless Chrome against dev data: at 1440 px the parts
    shrank (stages 448 to 403 px, the 30-day block 414 to 338 px), at
    390 px they barely moved, and tablets, which used the desktop values
    although their rows stack, get their own set measured at 1000 px
    (stages 792 px). Measured, not yet seen: whether the page still moves
    when production's data, rather than dev's, arrives; a tablet narrower
    or wider than 1000 px still moves a little.

13. **Scrollbars in the app's style.** Every scroller (the content card,
    the sidebar, the tables) gets a thin bar with a grey thumb mixed from
    the label color (35% at rest, 60% while its area is hovered) and no
    track, through the standard `scrollbar-color` and `scrollbar-width`
    [4][5], supported in Chromium since version 121 [5]; no new color
    value. Browsers without them keep their own bar; the older
    `::-webkit-scrollbar` pseudo-elements, which Chrome documents only as
    a fallback [5], are not added.

14. **Standalone pages** (login, not found, unexpected error; amends
    ADR-0039's look). One centered column on the app's ground. The logo's
    dot tells the page's state: the accent on login, a hollow grey ring on
    404 (nothing arrived), red on the error page. 404 and 500 carry a
    decorative strip of the panel's cells (eleven fine, then a missing or
    a failed one), hidden from screen readers: a picture of the page's
    story, not data. A mono code line follows the text: "HTTP 404 · <the
    asked path>", the path without its query, so a token carried there
    never shows; on the error page "HTTP 500 · istek <digest> · <time>",
    the digest being Next.js's own error code that the server log also
    holds, with a button to copy the line. Two actions side by side: the
    primary in the accent on edge and text, the secondary plain. 404
    offers the health panel and the sign-in. Login
    shortens its footnote, and below a "Ziyaretçi misin" divider links the
    health panel with the system's live state and last run time, read
    from the same public part as the panel; while the API cannot answer
    the line is left out. The Google button keeps what Google's branding
    guidelines fix [6]: the theme's fill, its 1 px stroke (#8E918F in
    dark, lighter than the mockup's edge), the standard-color G on white
    (the mockup's one-color G is a prohibited variation), and Google Sans
    Medium. The guidelines leave the corners and boundary to Material and
    allow scaling, so the button takes the page's 44 px height and 8 px
    corners. The column widens from 22 rem to 25 rem for the two
    actions. The locked pages' way to the health panel becomes the same
    quiet secondary button, with the health icon and a shorter label. The
    locked pages' mail game draws on the content's own ground
    (`--color-ground`), so its stage no longer shows as a darker box on
    the card, and while it runs a press anywhere on the content card jumps
    (links and buttons keep their action); opening it still takes the
    envelope.

15. **Three screen ranges** (amends ADR-0047 point 1 and ADR-0041). A
    phone is below 48 rem (768 px), as before; a tablet from 48 rem to
    below 75 rem (1200 px); wider is a computer. Each range is named once
    in `media.css` (`--phone`, `--tablet`). The bound follows Android's
    window size classes, which Material shares: tablets in portrait fall
    in 600 to 840 dp and in landscape in 840 to 1200 dp, and 1200 dp is
    where large displays begin [7]. The sidebar collapses on tablets only:
    a computer has room for it, so there it stays open and has no toggle,
    whatever choice the cookie holds; phones have no sidebar. Verified:
    the built stylesheet carries `@media (48rem <= width < 75rem)`. The
    health panel's legends sit under their sections on tablets as on
    phones: beside a heading at that width they wrap and crowd it.

16. **The list toolbar's right side and the pagination bar.** The search
    is a filled field without an edge (`--color-active`; the edge shows on
    focus) and keeps its earlier width (at most 28 rem; the mockup's
    narrower field read as too short, owner's review). Beside it a mailbox
    pill says when the mailbox was last read: "Gmail · 3 dk önce" in green
    while the last hourly run succeeded on time, amber with the time when
    it is late or no run exists yet, red "son çalışma başarısız" when it
    failed; the mockup's "bağlantı hatası" is not used, since the run
    record does not say the failure was the connection. This delivers
    ADR-0039 point 4 from the health panel's public runs part, which the
    sidebar's dot already reads, instead of a query of its own on
    `marts.fct_job_freshness`: no new query and no new grant. The pager's
    arrows keep the control edge, page numbers are plain, and the current
    page is a raised box with the control edge instead of a solid light
    fill; the rows-per-page select takes the same edge. When the toolbar
    runs narrower than 64 rem (a container query on the toolbar), the
    pill drops its time and keeps the dot and "Gmail", so tabs, search,
    and pill stay on one line; the time stays in the pill's title and is
    still read aloud. Below 56 rem the pill is given up altogether (the
    sidebar's dot and the health panel still tell the state). Below
    50 rem the search moves above the tabs and spans its line, instead of
    wrapping under them; the tabs keep the toolbar's bottom edge. The
    pager thins out the same way below 46 rem of its own width: the
    rows-per-page words are hidden visually (the select keeps its name)
    and the page links take the phones' shorter window. Phones keep their search, pager, and no pill
    (ADR-0047); their toolbar is no container, since a container becomes
    the reference box for the period list, which is placed against the
    screen there.

17. **Lists on tablets.** The application columns step down by the
    table's own width, measured by a container query on its scroller so
    the sidebar's state counts. At 90 rem and wider they keep their full
    widths; below it the short columns take compact widths (channel 7,
    location 9, applied 6, last event 7.5, status 9 rem), so the position
    keeps its room. Shares were tried first and failed: table columns
    treat a calc() mixing a percentage with a length (`min()`, `clamp()`)
    as auto, so every column came out equal and the position fell to
    150 px on a 1100 px card (owner's review). Below 60 rem the channel
    column is given up: its width goes to zero and the channel joins the
    company's line ("Coderspace · LinkedIn"), as in the mockup. The
    minimum table width drops from 84 rem to 53 rem, the narrowest at
    which the position and company still read (owner's review; postings,
    whose columns are plain shares: 72 rem to 44 rem); below it the table
    scrolls sideways, as WCAG reflow allows for data tables. Phones keep
    their stacked rows and no channel.

18. **A sort menu in both lists** (amends ADR-0042's sorting). The phones'
    order line ("Son görülme ↓", "Son gelişme ↓", with the clear link)
    took a row of its own and is gone; instead both toolbars carry a sort
    menu beside the period menu, on every screen, built as the period menu
    is (the two now share one component): its button shows the current
    order's short name after a sort icon ("⇅ Son görülen"), its list the
    long names under a "Sırala" heading, and away from the default it is
    underlined with a cross back to it. On phones the filter row scrolls
    to a menu away from its default when the page arrives, so a list
    ordered or narrowed off screen says why. Wide screens keep sorting by
    the date columns' headers as a shortcut; both set the same address.
    Postings: last seen (default), first seen, and alert count, which the
    API now sorts by (the last sighting breaking ties; tested), and the
    match score shown but not yet a choice: it belongs to Phase 2, which
    CLAUDE.md keeps out of Phase 1, and is listed now on the owner's
    decision, marked "yakında" for screen readers. Applications, sorted by
    the web server: last event (default), applied, longest silent (waiting
    applications first, the longest silent on top, then the rest newest
    first, so closed ones do not lead a follow-up list), and company in
    Turkish alphabetical order, one company's applications newest first;
    both checked against sample rows.

## Rationale

1. **Keep both status sets, one per screen.** Rejected: the same state
   would read differently on two pages.
2. **The lists' brighter set.** Rejected: its green and red differ in
   lightness, so an error shouts; the health panel's pair is balanced.
3. **The dark accent in light too.** Rejected: 2.49:1 on white fails
   WCAG 1.4.3 [1].
4. **Blue for progress (ADR-0034).** Replaced by the owner's rule: amber
   marks anything moving or late; blue is kept for the accent alone.

## Consequences

**Positive:**

- Every pair measured against every surface it can sit on, with the WCAG
  formula: dark text pairs at least 4.64:1 (label on the active item),
  light at least 4.72:1 (the same pair); status bases at least 3.11:1 on
  their surfaces, which non-text parts need [2]; badge text on its tint at
  least 5.05:1.
- A palette change is a change to one file.

**Negative / trade-offs:**

- Amber now means both progress and the silent badge's "action
  suggested"; revisit if the owner wants them apart.
- The light theme is derived, not drawn; it is approved from the owner's
  review.

## References

1. [Understanding SC 1.4.3 Contrast (Minimum) — W3C WAI](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum)
2. [Understanding SC 1.4.11 Non-text Contrast — W3C WAI](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast)
3. [color-mix() — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix)
4. [scrollbar-color — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-color)
5. [Scrollbar styling — Chrome for Developers](https://developer.chrome.com/docs/css-ui/scrollbar-styling)
6. [Sign in with Google branding guidelines — Google for Developers](https://developers.google.com/identity/branding-guidelines)
7. [Use window size classes — Android Developers](https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes) (Material's own page returned HTTP 404)
