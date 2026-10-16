// The status line (ADR-0044): whether the last hourly run succeeded and how
// long ago, the on-time streak, and the running version. A run older than
// the freshness target reads as late.
import type { RunsPanel } from "@/lib/panel";
import { COMPLETE, formatClock, minutesBetween } from "@/lib/panel";
import { strings } from "@/lib/strings";

import styles from "./HealthPanel.module.css";

const text = strings.health.status;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
// Past this many hours, "N days ago" reads better than hours.
const DAYS_AFTER_HOURS = 48;

function ago(minutes: number): string {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < 1) {
    return text.minutesAgo(minutes);
  }
  if (hours < DAYS_AFTER_HOURS) {
    return text.hoursAgo(hours);
  }
  return text.daysAgo(Math.floor(hours / HOURS_PER_DAY));
}

function state(
  panel: RunsPanel,
  minutes: number,
): { label: string; className: string | undefined } {
  if (panel.last_ingest === null) {
    return { label: text.noRun, className: styles.stateLate };
  }
  if (panel.last_ingest.run_status !== COMPLETE) {
    return { label: text.failed, className: styles.stateFailed };
  }
  if (minutes > panel.freshness_target_hours * MINUTES_PER_HOUR) {
    return { label: text.late, className: styles.stateLate };
  }
  return { label: text.running, className: styles.stateOk };
}

export function StatusLine({
  panel,
  now,
  version,
}: {
  panel: RunsPanel;
  now: Date;
  version: string | null;
}) {
  const started = panel.last_ingest ? new Date(panel.last_ingest.started_at) : null;
  const minutes = started ? minutesBetween(started, now) : 0;
  const current = state(panel, minutes);
  return (
    <div className={styles.status}>
      <span className={current.className}>{current.label}</span>
      {started ? (
        <>
          <span className={styles.meta}>
            {text.lastRun} <b>{formatClock(started)}</b>
          </span>
          <span className={styles.meta}>
            <b>{ago(minutes)}</b> {text.ago}
          </span>
        </>
      ) : null}
      <span className={styles.meta}>
        <b>{text.streak(panel.on_time_streak_hours)}</b> {text.streakLabel}
      </span>
      {version ? (
        <span className={styles.meta}>
          {text.version} <b>{version}</b>
        </span>
      ) : null}
    </div>
  );
}
