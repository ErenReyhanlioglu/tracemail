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

// What the list can be sorted by (ADR-0042, ADR-0052): the two date
// columns, how long a waiting application has been silent, or the company;
// the web server sorts, since it holds the whole list.
export type ApplicationSortKey = "applied" | "last_event" | "silence" | "company";
export const APPLICATION_SORT_KEYS: readonly ApplicationSortKey[] = [
  "applied",
  "last_event",
  "silence",
  "company",
];
export const DEFAULT_APPLICATION_SORT: Sort<ApplicationSortKey> = {
  key: "last_event",
  order: "desc",
};
// The sort menu's choices in order, each with the order it starts in.
export const APPLICATION_SORT_MENU: readonly ApplicationSortKey[] = [
  "last_event",
  "applied",
  "silence",
  "company",
];
export const APPLICATION_SORT_ORDER: Record<ApplicationSortKey, "asc" | "desc"> = {
  last_event: "desc",
  applied: "desc",
  silence: "desc",
  company: "asc",
};

type Compare = (a: Application, b: Application) => number;

// Ascending by a date that may be missing; a missing date goes last either
// way, so the caller flips only the dated part.
function byDate(pick: (application: Application) => string | null, direction: number): Compare {
  return (a, b) => {
    const first = pick(a);
    const second = pick(b);
    if (first === second) {
      return 0;
    }
    if (first === null || second === null) {
      return first === null ? 1 : -1;
    }
    return first < second ? -direction : direction;
  };
}

const newestEvent = byDate((application) => application.last_event_date, -1);

// Waiting applications first, the longest silent on top; the rest (in
// progress, rejected, closed) after them, newest first: a follow-up list.
function bySilence(direction: number): Compare {
  return (a, b) => {
    const waitingA = matchesFilter(a, "waiting");
    const waitingB = matchesFilter(b, "waiting");
    if (waitingA !== waitingB) {
      return waitingA ? -1 : 1;
    }
    if (!waitingA) {
      return newestEvent(a, b);
    }
    return (a.days_since_last_event - b.days_since_last_event) * direction;
  };
}

// By company in Turkish alphabetical order; one company's applications
// newest first.
function byCompany(direction: number): Compare {
  return (a, b) => {
    const order = (a.company ?? "").localeCompare(b.company ?? "", "tr") * direction;
    return order === 0 ? newestEvent(a, b) : order;
  };
}

function compareFor(sort: Sort<ApplicationSortKey>): Compare {
  const direction = sort.order === "desc" ? -1 : 1;
  switch (sort.key) {
    case "applied":
      return byDate((application) => application.applied_on, direction);
    case "last_event":
      return byDate((application) => application.last_event_date, direction);
    case "silence":
      return bySilence(direction);
    case "company":
      return byCompany(direction);
  }
}

// A copy in the chosen order; ties keep the API's order.
export function sortApplications(
  applications: Application[],
  sort: Sort<ApplicationSortKey>,
): Application[] {
  return [...applications].sort(compareFor(sort));
}
