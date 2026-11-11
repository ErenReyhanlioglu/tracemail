// The sidebar's live parts (ADR-0052): the owner's counts beside the lists
// and their quick views, and the system's state beside the health panel.
// Counts are private: they are asked for only with the owner's session and
// a visitor receives none. Each loader runs once per request (React cache),
// so a list page and its sidebar share one answer. When the API cannot
// answer, the sidebar shows no count or dot instead of failing the page.
import "server-only";

import { cache } from "react";

import {
  ApiUnavailableError,
  fetchAllApplications,
  fetchPostings,
  fetchRunsPanel,
  NotSignedInError,
} from "@/lib/api";
import { type Application, type Filter, matchesFilter } from "@/lib/applications";
import { DEFAULT_POSTING_SORT, PERIOD_DAYS, type PostingPage } from "@/lib/postings";
import { type SystemState, systemState } from "@/lib/systemState";

import type { CountKey } from "@/components/shell/navItems";

export type NavCounts = Record<CountKey, number>;

// Only the counts are needed; the smallest page the API accepts.
const COUNT_PAGE_SIZE = 1;

function count(applications: Application[], filter: Filter): number {
  return applications.filter((application) => matchesFilter(application, filter)).length;
}

// The posting counts of a period (all if null); only the counts are read.
async function postingCounts(days: number | null): Promise<PostingPage["counts"]> {
  const page = await fetchPostings({
    status: "all",
    days,
    query: "",
    sort: DEFAULT_POSTING_SORT.key,
    order: DEFAULT_POSTING_SORT.order,
    page: 1,
    pageSize: COUNT_PAGE_SIZE,
  });
  return page.counts;
}

async function quietly<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof ApiUnavailableError || error instanceof NotSignedInError) {
      return null;
    }
    throw error;
  }
}

export const loadApplications = cache(fetchAllApplications);

export const loadNavCounts = cache(async (): Promise<NavCounts | null> =>
  quietly(async () => {
    const [applications, everyPosting, recentPostings] = await Promise.all([
      loadApplications(),
      postingCounts(null),
      postingCounts(PERIOD_DAYS.month),
    ]);
    return {
      // New postings of the last 30 days: what is still waiting to be read.
      postings: recentPostings.new,
      applications: applications.length,
      inProgress: count(applications, "in_progress"),
      waiting: count(applications, "waiting"),
      saved: everyPosting.saved,
      rejected: count(applications, "rejected"),
    };
  }),
);

// The system's state and when its last run started: the sidebar's dot and
// the login page's status line (ADR-0052). Public data, from the same part
// as the health panel.
export interface SystemSummary {
  state: SystemState;
  lastRun: Date | null;
}

export const loadSystemSummary = cache(async (): Promise<SystemSummary | null> =>
  quietly(async () => {
    const panel = await fetchRunsPanel();
    return {
      state: systemState(panel, new Date()),
      lastRun: panel.last_ingest ? new Date(panel.last_ingest.started_at) : null,
    };
  }),
);

export const loadSystemState = cache(
  async (): Promise<SystemState | null> => (await loadSystemSummary())?.state ?? null,
);
