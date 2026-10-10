// The application list as a table with fixed columns (ADR-0034): every
// application has the same fields, so each field gets one column. Columns
// have fixed widths, cells never wrap (long text is cut with an ellipsis and
// shown whole on hover), so every row has the same height.
import type { ReactNode } from "react";

import type { Application } from "@/lib/applications";
import { formatDayMonth } from "@/lib/format";
import { badgesFor, daysAgo } from "@/lib/status";
import { strings } from "@/lib/strings";

import styles from "./ApplicationTable.module.css";
import { StatusBadge } from "./StatusBadge";

const text = strings.applications;

function channelLabel(channel: string | null): string {
  return channel ? (strings.channels[channel] ?? channel) : text.unknown;
}

function Clipped({ value, className }: { value: string; className?: string }) {
  return (
    <span className={className ? `${styles.clip} ${className}` : styles.clip} title={value}>
      {value}
    </span>
  );
}

function StatusCell({ application }: { application: Application }) {
  const badges = badgesFor(application);
  if (badges.length === 0) {
    return <Clipped value={strings.status.closedWithoutReply} className={styles.closedNote} />;
  }
  return (
    <span className={styles.badges}>
      {badges.map((badge) => (
        <StatusBadge key={badge.tone} badge={badge} />
      ))}
    </span>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

function PostingLink({ application }: { application: Application }) {
  if (!application.posting_url) {
    return null;
  }
  const label = text.openPosting(application.company ?? text.noCompany);
  return (
    <a
      className={styles.link}
      href={application.posting_url}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      title={label}
    >
      <ExternalIcon />
    </a>
  );
}

function Row({ application }: { application: Application }) {
  const rowClass = application.is_closed_without_reply ? styles.closed : undefined;
  return (
    <tr className={rowClass}>
      <td>
        <Clipped value={application.company ?? text.noCompany} className={styles.company} />
        <Clipped value={application.title ?? text.noTitle} className={styles.title} />
      </td>
      <td>
        <Clipped value={channelLabel(application.channel)} className={styles.mono} />
      </td>
      <td>
        <Clipped value={application.location ?? text.unknown} className={styles.secondary} />
      </td>
      <td>
        <Clipped
          value={application.applied_on ? formatDayMonth(application.applied_on) : text.unknown}
          className={styles.mono}
        />
      </td>
      <td>
        <Clipped value={formatDayMonth(application.last_event_date)} className={styles.mono} />
        <Clipped value={daysAgo(application.days_since_last_event)} className={styles.ago} />
      </td>
      <td>
        <StatusCell application={application} />
      </td>
      <td className={styles.linkCell}>
        <PostingLink application={application} />
      </td>
    </tr>
  );
}

export function ApplicationTable({
  applications,
  footer,
}: {
  applications: Application[];
  footer: ReactNode;
}) {
  const columns = text.columns;
  return (
    <div className={styles.panel}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <colgroup>
            <col />
            <col className={styles.colChannel} />
            <col className={styles.colLocation} />
            <col className={styles.colDate} />
            <col className={styles.colLastEvent} />
            <col className={styles.colStatus} />
            <col className={styles.colLink} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{columns.application}</th>
              <th scope="col">{columns.channel}</th>
              <th scope="col">{columns.location}</th>
              <th scope="col">{columns.appliedOn}</th>
              <th scope="col">{columns.lastEvent}</th>
              <th scope="col">{columns.status}</th>
              <td aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {applications.map((application) => (
              <Row key={application.application_key} application={application} />
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
