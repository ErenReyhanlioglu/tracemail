// The application list (ADR-0034): one column per field, fixed widths, one
// line per cell, so every row has the same height. On phones each row
// stacks into the position beside the last event's date, the company beside
// the location, then the status (ADR-0047).
import type { Application } from "@/lib/applications";
import { formatDayMonth } from "@/lib/format";
import { badgesFor, daysAgo } from "@/lib/status";
import { strings } from "@/lib/strings";

import styles from "./DataTable.module.css";
import { StatusBadge } from "./StatusBadge";
import {
  Clipped,
  ExternalLink,
  TableHead,
  type TableShape,
  type TableSorting,
  tableStyle,
} from "./TableParts";

const text = strings.applications;

export const APPLICATION_TABLE: TableShape = {
  columns: [
    { label: text.columns.application, width: null },
    { label: text.columns.channel, width: "--col-channel" },
    { label: text.columns.location, width: "--col-location" },
    { label: text.columns.appliedOn, width: "--col-date", sortKey: "applied" },
    { label: text.columns.lastEvent, width: "--col-last-event", sortKey: "last_event" },
    { label: text.columns.status, width: "--col-status" },
  ],
  minWidth: "--applications-min-width",
};

function channelLabel(channel: string | null): string {
  return channel ? (strings.channels[channel] ?? channel) : text.unknown;
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


function Row({ application }: { application: Application }) {
  const company = application.company ?? text.noCompany;
  const rowClass = application.is_closed_without_reply ? styles.closed : undefined;
  return (
    <tr className={rowClass}>
      <td className={styles.cellMain}>
        <Clipped value={application.title ?? text.noTitle} className={styles.lead} />
        <Clipped value={company} className={styles.sub} />
      </td>
      <td className={styles.cellExtra}>
        <Clipped value={channelLabel(application.channel)} className={styles.mono} />
      </td>
      <td className={styles.cellExtra}>
        <Clipped value={application.location ?? text.unknown} className={styles.secondary} />
      </td>
      <td className={styles.cellExtra}>
        <Clipped
          value={application.applied_on ? formatDayMonth(application.applied_on) : text.unknown}
          className={styles.mono}
        />
      </td>
      <td className={styles.cellDate}>
        <Clipped value={formatDayMonth(application.last_event_date)} className={styles.mono} />
        <Clipped
          value={daysAgo(application.days_since_last_event)}
          className={`${styles.ago} ${styles.wideOnly}`}
        />
        {/* Phones only: the location, under the date. */}
        {application.location ? (
          <Clipped value={application.location} className={`${styles.place} ${styles.phoneOnly}`} />
        ) : null}
      </td>
      <td className={styles.cellStatus}>
        <StatusCell application={application} />
      </td>
      <td className={styles.linkCell}>
        <ExternalLink href={application.posting_url} label={text.openPosting(company)} />
      </td>
    </tr>
  );
}

export function ApplicationTable({
  applications,
  sorting,
}: {
  applications: Application[];
  sorting: TableSorting;
}) {
  return (
    <div className={styles.scroll}>
      <table className={styles.table} style={tableStyle(APPLICATION_TABLE)}>
        <TableHead shape={APPLICATION_TABLE} sorting={sorting} />
        <tbody>
          {applications.map((application) => (
            <Row key={application.application_key} application={application} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
