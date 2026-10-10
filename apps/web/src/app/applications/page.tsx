// The owner's application list (step 1.10). Data is fetched on the server
// with the session cookie; without a session the visitor is sent to login
// and receives no data.
import { AppShell } from "@/components/AppShell";
import { ApplicationTable } from "@/components/ApplicationTable";
import { ChipGroup } from "@/components/ChipGroup";
import { Pagination } from "@/components/Pagination";
import { fetchAllApplications } from "@/lib/api";
import {
  type Application,
  FILTERS,
  type Filter,
  isFilter,
  matchesFilter,
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
} from "@/lib/paging";
import { strings } from "@/lib/strings";

import styles from "../list.module.css";

export const dynamic = "force-dynamic";

const PATH = "/applications";
const FILTER_LABELS: Record<Filter, string> = {
  all: strings.applications.filters.all,
  in_progress: strings.applications.filters.inProgress,
  silent: strings.applications.filters.silent,
  rejected: strings.applications.filters.rejected,
};

function location(filter: Filter): ListLocation {
  return { path: PATH, query: filter === "all" ? {} : { filter } };
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string; size?: string }>;
}) {
  const params = await searchParams;
  const filter: Filter = isFilter(params.filter) ? params.filter : "all";
  const applications = await loadPrivate(fetchAllApplications);
  return (
    <AppShell active="applications">
      <header className={styles.header}>
        <h1 className={styles.title}>{strings.applications.title}</h1>
        <span className={styles.summary}>{strings.applications.sortNote}</span>
      </header>
      {applications === null ? (
        <p className={styles.message}>{strings.errors.unavailable}</p>
      ) : (
        <ApplicationList
          applications={applications}
          filter={filter}
          pageParam={params.page}
          size={parsePageSize(params.size)}
        />
      )}
    </AppShell>
  );
}

function ApplicationList({
  applications,
  filter,
  pageParam,
  size,
}: {
  applications: Application[];
  filter: Filter;
  pageParam: string | undefined;
  size: PageSize;
}) {
  const matching = applications.filter((a) => matchesFilter(a, filter));
  const page = parsePage(pageParam, pageCount(matching.length, size));
  const chips = FILTERS.map((option) => ({
    key: option,
    label: FILTER_LABELS[option],
    count: applications.filter((a) => matchesFilter(a, option)).length,
    href: listUrl(location(option), 1, size),
    active: option === filter,
  }));
  return (
    <>
      <div className={styles.filters}>
        <ChipGroup chips={chips} />
      </div>
      {matching.length === 0 ? (
        <p className={styles.message}>{strings.applications.empty}</p>
      ) : (
        <ApplicationTable
          applications={pageSlice(matching, page, size)}
          footer={
            <Pagination
              location={location(filter)}
              page={page}
              size={size}
              total={matching.length}
              noun={strings.applications.noun}
            />
          }
        />
      )}
    </>
  );
}
