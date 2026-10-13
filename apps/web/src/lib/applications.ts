// The application list as the API returns it, how each application maps to
// the status badges of ADR-0034, and the list's groups and sort (ADR-0042).
import type { Sort } from "@/lib/sorting";

export type ApplicationStatus = "applied" | "in_progress" | "rejected";

export interface Application {
  application_key: string;
  company: string | null;
  title: string | null;
  location: string | null;
  channel: string | null;
  posting_url: string | null;
  applied_on: string | null;
  current_status: ApplicationStatus | null;
  last_event_date: string;
  days_since_last_event: number;
  is_silent: boolean;
  is_closed_without_reply: boolean;
  event_count: number;
}

export interface ApplicationPage {
  items: Application[];
  page: number;
  page_size: number;
  total: number;
}

// Badge tones, one meaning each (ADR-0034): warning asks for action,
// danger is a declined application, progress is workflow movement,
// neutral is waiting.
export type BadgeTone = "warning" | "danger" | "progress" | "neutral";

// Status groups of the list filter (ADR-0042). They do not overlap and add
// up to the total: an application closed without reply (ADR-0027) is no
// longer waiting or in progress. Silence is a badge, not a group.
export type Filter = "all" | "waiting" | "in_progress" | "rejected" | "closed";

export const FILTERS: readonly Filter[] = ["all", "waiting", "in_progress", "rejected", "closed"];

export function isFilter(value: string | undefined): value is Filter {
  return FILTERS.some((filter) => filter === value);
}

export function matchesFilter(application: Application, filter: Filter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "waiting":
      return application.current_status === "applied" && !application.is_closed_without_reply;
    case "in_progress":
      return application.current_status === "in_progress" && !application.is_closed_without_reply;
    case "rejected":
      return application.current_status === "rejected";
    case "closed":
      return application.is_closed_without_reply;
  }
}

// Date columns the list can be sorted by; the web server sorts, since it
// holds the whole list.
export type ApplicationSortKey = "applied" | "last_event";
export const APPLICATION_SORT_KEYS: readonly ApplicationSortKey[] = ["applied", "last_event"];
export const DEFAULT_APPLICATION_SORT: Sort<ApplicationSortKey> = {
  key: "last_event",
  order: "desc",
};

function sortDate(application: Application, key: ApplicationSortKey): string | null {
  return key === "applied" ? application.applied_on : application.last_event_date;
}

// A copy in the chosen order. Dates are ISO strings, so they compare as
// text; a missing date goes last either way, and ties keep the API's order.
export function sortApplications(
  applications: Application[],
  sort: Sort<ApplicationSortKey>,
): Application[] {
  const direction = sort.order === "desc" ? -1 : 1;
  return [...applications].sort((a, b) => {
    const first = sortDate(a, sort.key);
    const second = sortDate(b, sort.key);
    if (first === second) {
      return 0;
    }
    if (first === null || second === null) {
      return first === null ? 1 : -1;
    }
    return first < second ? -direction : direction;
  });
}
