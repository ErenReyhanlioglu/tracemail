// The owner's application list (step 1.10), filtered by status group and
// by a search of company and title, and sorted by a date column (ADR-0042).
// Data is fetched on the server with the session cookie; without a session
// the visitor is sent to the public panel and receives no data.
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { ApplicationTable } from "@/components/ApplicationTable";
import { EmptyState, NoMatchState, UnavailableState } from "@/components/ListState";
import { ListPanel } from "@/components/ListPanel";
import panelStyles from "@/components/ListPanel.module.css";
import { Pagination } from "@/components/Pagination";
import { SearchBox } from "@/components/SearchBox";
import { SegmentedControl } from "@/components/SegmentedControl";
import type { TableSorting } from "@/components/TableParts";
import { fetchAllApplications } from "@/lib/api";
import {
  APPLICATION_SORT_KEYS,
  type Application,
  type ApplicationSortKey,
  DEFAULT_APPLICATION_SORT,
  FILTERS,
  type Filter,
  isFilter,
  matchesFilter,
  sortApplications,
} from "@/lib/applications";
import { loadPrivate } from "@/lib/load";
import {
  type ListLocation,
  listUrl,
  pageCount,
  type PageSize,
  pageSlice,
  parsePage,
  parsePageSize,
  sizeQuery,
} from "@/lib/paging";
import { matchesSearch, parseQuery, SEARCH_PARAM } from "@/lib/search";
import { nextSort, parseSort, type Sort, sortQuery } from "@/lib/sorting";
import { strings } from "@/lib/strings";

import styles from "../list.module.css";

export const dynamic = "force-dynamic";

const PATH = "/applications";
const text = strings.applications;

// Behind login: never indexed, whatever the response status (ADR-0039).
export const metadata: Metadata = {
  title: strings.pageTitle(text.title),
  robots: { index: false },
};
const FILTER_LABELS: Record<Filter, string> = {
  all: text.filters.all,
  waiting: text.filters.waiting,
  in_progress: text.filters.inProgress,
  rejected: text.filters.rejected,
  closed: text.filters.closed,
};

// Everything that selects and orders the list's rows.
interface Filters {
  filter: Filter;
  search: string;
  sort: Sort<ApplicationSortKey>;
}

function query({ filter, search, sort }: Filters): Record<string, string> {
  const result = sortQuery(sort, DEFAULT_APPLICATION_SORT);
  if (filter !== "all") {
    result.filter = filter;
  }
  if (search) {
    result[SEARCH_PARAM] = search;
  }
  return result;
}

function location(filters: Filters): ListLocation {
  return { path: PATH, query: query(filters) };
}

function at(filters: Filters, size: PageSize): string {
  return listUrl(location(filters), 1, size);
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filters: Filters = {
    filter: isFilter(params.filter) ? params.filter : "all",
    search: parseQuery(params.q),
    sort: parseSort(APPLICATION_SORT_KEYS, DEFAULT_APPLICATION_SORT, params.sort, params.order),
  };
  const applications = await loadPrivate(fetchAllApplications);
  return (
    <AppShell active="applications" viewer="owner">
      <header className={styles.header}>
        <h1 className={styles.title}>{text.title}</h1>
      </header>
      {applications === null ? (
        <UnavailableState />
      ) : applications.length === 0 ? (
        <EmptyState title={text.emptyTitle} body={text.emptyBody} />
      ) : (
        <ApplicationList
          applications={applications}
          filters={filters}
          size={parsePageSize(params.size)}
          pageParam={params.page}
        />
      )}
    </AppShell>
  );
}

// The toolbar: status segments, counted within the search, on the left; a
// way back to the full list once filtered, and the search, on the right.
function toolbarParts(
  searched: Application[],
  filters: Filters,
  size: PageSize,
): { start: ReactNode; end: ReactNode } {
  const cleared = { ...filters, filter: "all" as const, search: "" };
  return {
    start: (
      <SegmentedControl
        label={text.filterLabel}
        segments={FILTERS.map((option) => ({
          key: option,
          label: FILTER_LABELS[option],
          count: searched.filter((a) => matchesFilter(a, option)).length,
          href: at({ ...filters, filter: option }, size),
          selected: option === filters.filter,
        }))}
      />
    ),
    end: (
      <>
        {filters.filter !== "all" || filters.search !== "" ? (
          <Link className={panelStyles.clear} href={at(cleared, size)}>
            {text.clearFilters}
          </Link>
        ) : null}
        <SearchBox
          path={PATH}
          query={filters.search}
          keep={{ ...query({ ...filters, search: "" }), ...sizeQuery(size) }}
          placeholder={text.searchPlaceholder}
        />
      </>
    ),
  };
}

function sortingOf(filters: Filters, size: PageSize): TableSorting {
  const hrefs = Object.fromEntries(
    APPLICATION_SORT_KEYS.map((key) => [
      key,
      at({ ...filters, sort: nextSort(filters.sort, key) }, size),
    ]),
  );
  return { ...filters.sort, hrefs };
}

function ApplicationList({
  applications,
  filters,
  size,
  pageParam,
}: {
  applications: Application[];
  filters: Filters;
  size: PageSize;
  pageParam: string | undefined;
}) {
  const searched = applications.filter((a) => matchesSearch(filters.search, a.company, a.title));
  const matching = sortApplications(
    searched.filter((a) => matchesFilter(a, filters.filter)),
    filters.sort,
  );
  const page = parsePage(pageParam, pageCount(matching.length, size));
  const { start, end } = toolbarParts(searched, filters, size);
  if (matching.length === 0) {
    return (
      <ListPanel start={start} end={end}>
        <NoMatchState
          title={text.noMatch}
          clearLabel={text.clearFilters}
          clearHref={at({ ...filters, filter: "all", search: "" }, size)}
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
          page={page}
          size={size}
          total={matching.length}
          noun={text.noun}
        />
      }
    >
      <ApplicationTable
        applications={pageSlice(matching, page, size)}
        sorting={sortingOf(filters, size)}
      />
    </ListPanel>
  );
}
