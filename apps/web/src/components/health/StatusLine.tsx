// The status line (ADR-0044): whether the last hourly run succeeded and when
// it started, the on-time streak, and the running version. A run older than
// the freshness target reads as late (systemState.ts). Wide screens draw it
// as one banner line; phones as a card with the state on top and the three
// details in labelled cells (ADR-0052). One of the two shows.
import type { RunsPanel } from "@/lib/panel";
import { formatClock, minutesBetween } from "@/lib/panel";
import { strings } from "@/lib/strings";
import { type SystemState, systemState, timeSince } from "@/lib/systemState";

import styles from "./HealthPanel.module.css";

const text = strings.health.status;

// The banner's tone (ADR-0052): green unless late or failed.
const BANNER_CLASS: Record<SystemState, string | undefined> = {
  running: undefined,
  late: styles.statusLate,
  failed: styles.statusFailed,
  noRun: styles.statusLate,
};

const STATE_CLASS: Record<SystemState, string | undefined> = {
  running: styles.stateOk,
  late: styles.stateLate,
  failed: styles.stateFailed,
  noRun: styles.stateLate,
};

const MINUTES_PER_HOUR = 60;

// How far a late run is past the freshness target, as "35 dk gecikme".
function delay(panel: RunsPanel, started: Date | null, now: Date): string | null {
  if (started === null) {
    return null;
  }
  const past = minutesBetween(started, now) - panel.freshness_target_hours * MINUTES_PER_HOUR;
  return past > 0 ? text.delay(timeSince(past)) : null;
}

function StatusCard({
  panel,
  current,
  started,
  now,
  version,
}: {
  panel: RunsPanel;
  current: SystemState;
  started: Date | null;
  now: Date;
  version: string | null;
}) {
  const late = current === "late" ? delay(panel, started, now) : null;
  const streak = panel.on_time_streak_hours;
  const cells: [string, string][] = [
    [text.cells.lastRun, started ? formatClock(started) : text.none],
    [text.cells.streak, streak > 0 ? text.streak(streak) : text.none],
    [text.cells.version, version ?? text.none],
  ];
  return (
    <div className={`${styles.statusCard} ${BANNER_CLASS[current] ?? ""}`}>
      <div className={styles.statusCardHead}>
        <span className={STATE_CLASS[current]}>{text[current]}</span>
        {late ? <span className={styles.statusDelay}>{late}</span> : null}
      </div>
      <dl className={styles.statusCells}>
        {cells.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
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
  const current = systemState(panel, now);
  return (
    <>
      <StatusCard
        panel={panel}
        current={current}
        started={started}
        now={now}
        version={version}
      />
      <div className={`${styles.status} ${BANNER_CLASS[current] ?? ""}`}>
      <span className={STATE_CLASS[current]}>{text[current]}</span>
      {/* The last run's clock time; how long ago it was is left out, since
          the time says it (owner's review, ADR-0052). */}
      {started ? (
        <span className={styles.meta}>
          {text.lastRun} <b>{formatClock(started)}</b>
        </span>
      ) : null}
      <span className={styles.meta}>
        <b>{text.streak(panel.on_time_streak_hours)}</b> {text.streakLabel}
      </span>
      {/* A dash where the build carries no version (a local server), so
          the line keeps its shape, as the phone's card does. */}
      <span className={styles.meta}>
        {text.version} <b>{version ?? text.none}</b>
      </span>
      </div>
    </>
  );
}
