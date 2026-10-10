// Incoming postings as the API returns them, and the list's filters.

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

// The page's own query, without defaults, for list URLs.
export function postingsQuery(status: StatusFilter, period: Period): Record<string, string> {
  const query: Record<string, string> = {};
  if (status !== "all") {
    query.status = status;
  }
  if (period !== DEFAULT_PERIOD) {
    query.period = period;
  }
  return query;
}
