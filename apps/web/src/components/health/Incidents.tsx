// The incident log (ADR-0044): owner-approved summaries, newest first, each
// linking to its full report in the repository (CLAUDE.md, Incidents).
import { formatDayMonth } from "@/lib/format";
import { INCIDENTS_URL } from "@/lib/links";
import { strings } from "@/lib/strings";

import { ExternalIcon } from "../TableParts";
import styles from "./HealthPanel.module.css";

const text = strings.health.incidents;

export function Incidents() {
  return (
    <section className={styles.section} aria-labelledby="incidents-title">
      <div className={styles.head}>
        <h2 id="incidents-title" className={styles.heading}>
          {text.title}
        </h2>
      </div>
      <div className={styles.card}>
        {text.items.map((incident) => (
          <a
            key={incident.report}
            className={styles.incident}
            href={`${INCIDENTS_URL}/${incident.report}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            <time className={styles.incidentDate} dateTime={incident.date}>
              {formatDayMonth(incident.date)}
            </time>
            <div>
              <p className={styles.incidentTitle}>{incident.title}</p>
              {/* One paragraph cut at two lines on every screen; the report
                  has the rest (owner's review). */}
              <p className={styles.incidentBody}>
                {incident.body} <b>{text.solution}</b> {incident.solution}
              </p>
            </div>
            <span className={styles.incidentLink}>
              {text.open}
              <ExternalIcon />
              <span className="visually-hidden">, {strings.health.opensInNewTab}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
