// The system's state in one word (ADR-0044): whether the last hourly run
// succeeded, and whether it is recent enough. The health panel's status line
// and the sidebar's dot (ADR-0052) read it from here, so they never disagree.
import { COMPLETE, minutesBetween, type RunsPanel } from "@/lib/panel";
import { strings } from "@/lib/strings";

export type SystemState = "running" | "late" | "failed" | "noRun";

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
// Past this many hours, "N days" reads better than hours.
const DAYS_AFTER_HOURS = 48;

// How long ago, short: minutes, then hours, then days. The health panel's
// status line and the lists' mailbox pill (ADR-0052) both say it this way.
export function timeSince(minutes: number): string {
  const text = strings.health.status;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < 1) {
    return text.minutesAgo(minutes);
  }
  if (hours < DAYS_AFTER_HOURS) {
    return text.hoursAgo(hours);
  }
  return text.daysAgo(Math.floor(hours / HOURS_PER_DAY));
}

export function systemState(panel: RunsPanel, now: Date): SystemState {
  if (panel.last_ingest === null) {
    return "noRun";
  }
  if (panel.last_ingest.run_status !== COMPLETE) {
    return "failed";
  }
  const minutes = minutesBetween(new Date(panel.last_ingest.started_at), now);
  if (minutes > panel.freshness_target_hours * MINUTES_PER_HOUR) {
    return "late";
  }
  return "running";
}
