// Incoming postings (step 1.10): every posting seen in a job mail, filtered
// by what the owner did with it, by period, and by a search of title and
// company, and sorted by a date column (ADR-0042). Filtering, sorting, and
// paging happen in the API; this page fetches one page on the server.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/AppShell";
import { LockedPage } from "@/components/locked/LockedPage";
import { EmptyState, NoMatchState, UnavailableState } from "@/components/ListState";
import { ListPanel } from "@/components/ListPanel";
import panelStyles from "@/components/ListPanel.module.css";
import { Pagination } from "@/components/Pagination";
import { ListSummary } from "@/components/ListSummary";
import { PeriodMenu } from "@/components/PeriodMenu";
import { PostingTable } from "@/components/PostingTable";
import { SearchBox } from "@/components/SearchBox";
import { SegmentedControl } from "@/components/SegmentedControl";
import type { TableSorting } from "@/components/TableParts";
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
  type PostingFilters,
  type PostingPage,
  postingsQuery,
  STATUS_FILTERS,
} from "@/lib/postings";
import { parseQuery } from "@/lib/search";
import { nextSort, parseSort } from "@/lib/sorting";
import { strings } from "@/lib/strings";

import styles from "../list.module.css";

export const dynamic = "force-dynamic";

const PATH = "/postings";
// Phones sort by the last sighting only, the one date a phone row shows.
const PHONE_SORT_KEY = "last_seen" as const;
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

// The default filters, and whether the list has left them (a "clear" link
// shows then).
function cleared(filters: PostingFilters): PostingFilters {
  return { ...filters, status: "all", period: DEFAULT_PERIOD, search: "" };
}

function isChanged(filters: PostingFilters): boolean {
  return filters.status !== "all" || filters.period !== DEFAULT_PERIOD || filters.search !== "";
}

// The toolbar: status segments and the period menu on the left; a way back
// to the default filters once they changed, and the search, on the right.
function toolbarParts(
  data: PostingPage,
  filters: PostingFilters,
  size: PageSize,
): { start: ReactNode; end: ReactNode } {
  const changed = isChanged(filters);
  return {
    start: (
      <>
        <SegmentedControl
          label={text.statusLabel}
          segments={STATUS_FILTERS.map((option) => ({
            key: option,
            label: text.filters[option],
            count: data.counts[option],
            href: at({ ...filters, status: option }, size),
            selected: option === filters.status,
          }))}
        />
        <PeriodMenu
          label={text.periodLabel}
          active={filters.period !== "all"}
          options={PERIODS.map((option) => ({
            key: option,
            label: text.periods[option],
            href: at({ ...filters, period: option }, size),
            selected: option === filters.period,
          }))}
        />
      </>
    ),
    end: (
      <>
        {changed ? (
          <Link className={panelStyles.clear} href={at(cleared(filters), size)}>
            {text.clearFilters}
          </Link>
        ) : null}
        <SearchBox
          path={PATH}
          query={filters.search}
          keep={{ ...postingsQuery({ ...filters, search: "" }), ...sizeQuery(size) }}
          placeholder={text.searchPlaceholder}
        />
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
  const changed = isChanged(filters);
  return (
    <ListPanel
      start={start}
      end={end}
      summary={
        <ListSummary
          clearHref={changed ? at(cleared(filters), size) : null}
          clearLabel={text.clearFilters}
          sortLabel={text.columns.lastSeen}
          sortHref={at({ ...filters, sort: nextSort(filters.sort, PHONE_SORT_KEY) }, size)}
          order={filters.sort.key === PHONE_SORT_KEY ? filters.sort.order : null}
        />
      }
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
      <PostingTable postings={data.items} sorting={sortingOf(filters, size)} />
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
  const data = loaded.data;
  if (data && data.items.length === 0 && data.total > 0) {
    // Past the last page (a stale link or a smaller filter): open the last one.
    redirect(listUrl(location(filters), pageCount(data.total, size), size));
  }
  const neverAny =
    data !== null && data.counts.all === 0 && filters.period === "all" && filters.search === "";
  return (
    <AppShell active="postings" viewer="owner">
      <header className={styles.header}>
        <h1 className={styles.title}>{text.title}</h1>
      </header>
      {data === null ? (
        <UnavailableState />
      ) : neverAny ? (
        <EmptyState title={text.emptyTitle} body={text.emptyBody} />
      ) : (
        <PostingList data={data} filters={filters} size={size} />
      )}
    </AppShell>
  );
}
