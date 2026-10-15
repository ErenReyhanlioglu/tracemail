// Incoming postings as the API returns them, and the list's filters.
import { SEARCH_PARAM } from "@/lib/search";
import { type Sort, sortQuery } from "@/lib/sorting";

export type PostingStatus = "new" | "saved" | "applied";

export interface Posting {
  posting_key: string;
  title: string | null;
  company: string | null;
  location: string | null;
  posting_url: string | null;
  first_seen_date: string;
  last_seen_date: string;
  mention_count: number;
  is_saved: boolean;
  has_application: boolean;
  applied_on: string | null;
  status: PostingStatus;
}

export type StatusFilter = "all" | PostingStatus;

export const STATUS_FILTERS: readonly StatusFilter[] = ["all", "new", "saved", "applied"];

export interface PostingPage {
  items: Posting[];
  page: number;
  page_size: number;
  total: number;
  counts: Record<StatusFilter, number>;
}

// Periods by first-seen date; "all" sends no day limit.
export type Period = "week" | "month" | "all";

export const PERIODS: readonly Period[] = ["week", "month", "all"];
export const DEFAULT_PERIOD: Period = "week";
export const PERIOD_DAYS: Record<Period, number | null> = { week: 7, month: 30, all: null };

export function parseStatusFilter(value: string | undefined): StatusFilter {
  return STATUS_FILTERS.find((filter) => filter === value) ?? "all";
}

export function parsePeriod(value: string | undefined): Period {
  return PERIODS.find((period) => period === value) ?? DEFAULT_PERIOD;
}

// Date columns the list can be sorted by (ADR-0042); the API sorts.
export type PostingSortKey = "first_seen" | "last_seen";
export const POSTING_SORT_KEYS: readonly PostingSortKey[] = ["first_seen", "last_seen"];
// Newest sighting first (owner's review, ADR-0047): the last time a posting
// was seen matters more than the first, and it is the one date a phone row
// shows.
export const DEFAULT_POSTING_SORT: Sort<PostingSortKey> = { key: "last_seen", order: "desc" };

// Everything that selects and orders the list's rows.
export interface PostingFilters {
  status: StatusFilter;
  period: Period;
  search: string;
  sort: Sort<PostingSortKey>;
}

// The page's own query, without defaults, for list URLs.
export function postingsQuery({ status, period, search, sort }: PostingFilters): Record<string, string> {
  const query: Record<string, string> = sortQuery(sort, DEFAULT_POSTING_SORT);
  if (search) {
    query[SEARCH_PARAM] = search;
  }
  if (status !== "all") {
    query.status = status;
  }
  if (period !== DEFAULT_PERIOD) {
    query.period = period;
  }
  return query;
}
