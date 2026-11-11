// When the mailbox was last read, at the lists' top right (ADR-0039 point 4,
// drawn as in the v2 mockup, ADR-0052): green while the last hourly run
// succeeded on time, amber when it is late or none has run, red when it
// failed. Read from the health panel's public runs part, the same answer as
// the sidebar's dot, so no query of its own; while the API cannot answer,
// the pill is left out.
import { loadSystemSummary } from "@/lib/navData";
import { minutesBetween } from "@/lib/panel";
import { strings } from "@/lib/strings";
import { type SystemState, timeSince } from "@/lib/systemState";

import styles from "./FreshnessPill.module.css";

const text = strings.freshness;

const TONE: Record<SystemState, string | undefined> = {
  running: styles.ok,
  late: styles.late,
  failed: styles.failed,
  noRun: styles.late,
};

function detail(state: SystemState, lastRun: Date | null): string {
  if (state === "failed") {
    return text.failed;
  }
  if (lastRun === null) {
    return text.noRun;
  }
  return text.ago(timeSince(minutesBetween(lastRun, new Date())));
}

export async function FreshnessPill() {
  const summary = await loadSystemSummary();
  if (!summary) {
    return null;
  }
  const when = detail(summary.state, summary.lastRun);
  return (
    <p className={`${styles.pill} ${TONE[summary.state] ?? ""}`} title={`${text.source} · ${when}`}>
      <span className="visually-hidden">{text.label}, </span>
      <span className={styles.source}>{text.source}</span>
      <span className={styles.detail}>{when}</span>
      {/* Read aloud even when a narrow toolbar hides the time. */}
      <span className={`visually-hidden ${styles.detailSpoken}`}>{when}</span>
    </p>
  );
}
