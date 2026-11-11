// Incoming postings (step 1.10): every posting seen in a job mail, filtered
// by what the owner did with it, by period, and by a search of title and
// company, and sorted by a date column (ADR-0042). Filtering, sorting, and
// paging happen in the API; this page fetches one page on the server.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { type ReactNode, Suspense } from "react";

import { AppShell } from "@/components/shell/AppShell";
import { LockedPage } from "@/components/locked/LockedPage";
import { EmptyState, NoMatchState, UnavailableState } from "@/components/ListState";
import { FreshnessPill } from "@/components/FreshnessPill";
import { ListPanel } from "@/components/ListPanel";
import { Pagination } from "@/components/Pagination";
import { ClockIcon, SortableIcon } from "@/components/icons/NavIcons";
import { PostingTable } from "@/components/PostingTable";
import { SearchBox } from "@/components/SearchBox";
import { SegmentedControl } from "@/components/SegmentedControl";
import type { TableSorting } from "@/components/TableParts";
import { ToolbarMenu } from "@/components/ToolbarMenu";
import { fetchPostings } from "@/lib/api";
import { loadPrivate } from "@/lib/load";
import {
  type ListLocation,
  listUrl,
  pageCount,
  type PageSize,
  parsePageSize,
  sizeQuery,
} from "@/lib/paging";
import {
  DEFAULT_PERIOD,
  DEFAULT_POSTING_SORT,
  parsePeriod,
  parseStatusFilter,
  PERIOD_DAYS,
  PERIODS,
  POSTING_SORT_KEYS,
  POSTING_SORT_MENU,
  POSTING_SORT_ORDER,
  type PostingFilters,
  type PostingPage,
  type PostingSortKey,
  postingsQuery,
  STATUS_FILTERS,
} from "@/lib/postings";
import { parseQuery } from "@/lib/search";
import { nextSort, parseSort } from "@/lib/sorting";
import { strings } from "@/lib/strings";


export const dynamic = "force-dynamic";

const PATH = "/postings";
// The match score's place in the sort menu, not a choice until Phase 2
// (owner's decision, ADR-0052).
const MATCH_SORT = "match";
const text = strings.postings;

// Behind login: never indexed, whatever the response status (ADR-0039).
export const metadata: Metadata = {
  title: strings.pageTitle(text.title),
  robots: { index: false },
};

function location(filters: PostingFilters): ListLocation {
  return { path: PATH, query: postingsQuery(filters) };
}

function at(filters: PostingFilters, size: PageSize): string {
  return listUrl(location(filters), 1, size);
}

// The sort menu (ADR-0052): each choice in the order it starts in, the
// match score shown but not yet a choice.
function SortMenu({ filters, size }: { filters: PostingFilters; size: PageSize }) {
  const sortAt = (key: PostingSortKey) =>
    at({ ...filters, sort: { key, order: POSTING_SORT_ORDER[key] } }, size);
  return (
    <ToolbarMenu
      label={strings.sortMenu.label}
      group="sort"
      icon={<SortableIcon />}
      heading={strings.sortMenu.heading}
      reset={{
        key: DEFAULT_POSTING_SORT.key,
        href: at({ ...filters, sort: DEFAULT_POSTING_SORT }, size),
        label: strings.sortMenu.reset,
      }}
      options={[
        ...POSTING_SORT_MENU.map((key) => ({
          key,
          ...text.sort[key],
          href: sortAt(key),
          selected: key === filters.sort.key,
        })),
        { key: MATCH_SORT, ...text.sort.match, href: null, selected: false },
      ]}
    />
  );
}

// The toolbar: status segments, the period menu, and the sort menu on the
// left, the search on the right. A narrowed period or a changed sort resets
// from its own cross (ADR-0052).
function toolbarParts(
  data: PostingPage,
  filters: PostingFilters,
  size: PageSize,
): { start: ReactNode; end: ReactNode } {
  return {
    start: (
      <>
        <SegmentedControl
          group="status"
          label={text.statusLabel}
          segments={STATUS_FILTERS.map((option) => ({
            key: option,
            label: text.filters[option],
            count: data.counts[option],
            href: at({ ...filters, status: option }, size),
            selected: option === filters.status,
          }))}
        />
        <ToolbarMenu
          label={text.periodLabel}
          group="period"
          icon={<ClockIcon />}
          reset={{
            key: DEFAULT_PERIOD,
            href: at({ ...filters, period: DEFAULT_PERIOD }, size),
            label: text.resetPeriod,
          }}
          options={PERIODS.map((option) => ({
            key: option,
            label: text.periods[option],
            href: at({ ...filters, period: option }, size),
            selected: option === filters.period,
          }))}
        />
        <SortMenu filters={filters} size={size} />
      </>
    ),
    end: (
      <>
        <SearchBox
          path={PATH}
          query={filters.search}
          keep={{ ...postingsQuery({ ...filters, search: "" }), ...sizeQuery(size) }}
          placeholder={text.searchPlaceholder}
        />
        {/* When the mailbox was last read (ADR-0052); it arrives on its own. */}
        <Suspense fallback={null}>
          <FreshnessPill />
        </Suspense>
      </>
    ),
  };
}

function sortingOf(filters: PostingFilters, size: PageSize): TableSorting {
  const hrefs = Object.fromEntries(
    POSTING_SORT_KEYS.map((key) => [
      key,
      at({ ...filters, sort: nextSort(filters.sort, key) }, size),
    ]),
  );
  return { ...filters.sort, hrefs };
}

function PostingList({
  data,
  filters,
  size,
}: {
  data: PostingPage;
  filters: PostingFilters;
  size: PageSize;
}) {
  const { start, end } = toolbarParts(data, filters, size);
  if (data.total === 0) {
    const everything = { ...filters, status: "all" as const, period: "all" as const, search: "" };
    return (
      <ListPanel start={start} end={end}>
        <NoMatchState
          title={text.noMatch}
          clearLabel={text.clearFilters}
          clearHref={at(everything, size)}
        />
      </ListPanel>
    );
  }
  return (
    <ListPanel
      start={start}
      end={end}
      footer={
        <Pagination
          location={location(filters)}
          page={data.page}
          size={size}
          total={data.total}
          noun={text.noun}
        />
      }
    >
      {/* Keyed by the list's address: a new page or filter starts its
          rows at the top of their scroller (ADR-0052). */}
      <PostingTable
        key={listUrl(location(filters), data.page, size)}
        postings={data.items}
        sorting={sortingOf(filters, size)}
      />
    </ListPanel>
  );
}

export default async function PostingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filters: PostingFilters = {
    status: parseStatusFilter(params.status),
    period: parsePeriod(params.period),
    search: parseQuery(params.q),
    sort: parseSort(POSTING_SORT_KEYS, DEFAULT_POSTING_SORT, params.sort, params.order),
  };
  const size = parsePageSize(params.size);
  const requested = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const loaded = await loadPrivate(() =>
    fetchPostings({
      status: filters.status,
      days: PERIOD_DAYS[filters.period],
      query: filters.search,
      sort: filters.sort.key,
      order: filters.sort.order,
      page: requested,
      pageSize: size,
    }),
  );
  if (loaded.locked) {
    return <LockedPage section="postings" title={text.title} viewer="visitor" />;
  }
  const data = loaded.ok ? loaded.data : null;
  if (data && data.items.length === 0 && data.total > 0) {
    // Past the last page (a stale link or a smaller filter): open the last one.
    redirect(listUrl(location(filters), pageCount(data.total, size), size));
  }
  const neverAny =
    data !== null && data.counts.all === 0 && filters.period === "all" && filters.search === "";
  return (
    <AppShell active="postings" viewer="owner" flush>
      <h1 className="visually-hidden">{text.title}</h1>
      {!loaded.ok ? (
        <UnavailableState reason={loaded.reason} />
      ) : neverAny ? (
        <EmptyState title={text.emptyTitle} body={text.emptyBody} />
      ) : (
        <PostingList data={loaded.data} filters={filters} size={size} />
      )}
    </AppShell>
  );
}
