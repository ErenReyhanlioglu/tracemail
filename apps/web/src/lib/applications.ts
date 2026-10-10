// The application list as the API returns it, and how each application maps
// to the status badges of ADR-0034.

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

export type Filter = "all" | "in_progress" | "silent" | "rejected";

export const FILTERS: readonly Filter[] = ["all", "in_progress", "silent", "rejected"];

export function isFilter(value: string | undefined): value is Filter {
  return FILTERS.some((filter) => filter === value);
}

export function matchesFilter(application: Application, filter: Filter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "in_progress":
      return application.current_status === "in_progress" && !application.is_closed_without_reply;
    case "silent":
      return application.is_silent;
    case "rejected":
      return application.current_status === "rejected";
  }
}
