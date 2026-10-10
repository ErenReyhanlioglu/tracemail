// The owner's application list (step 1.10). Data is fetched on the server
// with the session cookie; without a session the visitor is sent to login
// and receives no data.
import { redirect } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { ApplicationTable } from "@/components/ApplicationTable";
import { FilterChips } from "@/components/FilterChips";
import { Pagination } from "@/components/Pagination";
import { ApiUnavailableError, fetchAllApplications, NotSignedInError } from "@/lib/api";
import {
  type Application,
  FILTERS,
  type Filter,
  isFilter,
  matchesFilter,
} from "@/lib/applications";
import { pageCount, type PageSize, pageSlice, parsePage, parsePageSize } from "@/lib/paging";
import { strings } from "@/lib/strings";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

async function loadApplications(): Promise<Application[] | null> {
  try {
    return await fetchAllApplications();
  } catch (error) {
    if (error instanceof NotSignedInError) {
      redirect("/login");
    }
    if (error instanceof ApiUnavailableError) {
      return null;
    }
    throw error;
  }
}

function countByFilter(applications: Application[]): Record<Filter, number> {
  const entries = FILTERS.map(
    (filter) => [filter, applications.filter((a) => matchesFilter(a, filter)).length] as const,
  );
  return Object.fromEntries(entries) as Record<Filter, number>;
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string; size?: string }>;
}) {
  const params = await searchParams;
  const filter: Filter = isFilter(params.filter) ? params.filter : "all";
  const applications = await loadApplications();
  return (
    <AppShell>
      <header className={styles.header}>
        <h1 className={styles.title}>{strings.applications.title}</h1>
        <span className={styles.sortNote}>{strings.applications.sortNote}</span>
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
  const visible = pageSlice(matching, page, size);
  return (
    <>
      <FilterChips active={filter} size={size} counts={countByFilter(applications)} />
      {visible.length === 0 ? (
        <p className={styles.message}>{strings.applications.empty}</p>
      ) : (
        <ApplicationTable
          applications={visible}
          footer={<Pagination filter={filter} page={page} size={size} total={matching.length} />}
        />
      )}
    </>
  );
}
