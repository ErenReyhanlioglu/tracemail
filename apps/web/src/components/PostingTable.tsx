// The incoming-postings list: same table style as the application list. The
// status is plain text as in the mockup; role type, rough fit, and the match
// report join as columns in later phases.
import type { ReactNode } from "react";

import { formatDayMonth } from "@/lib/format";
import type { Posting } from "@/lib/postings";
import { strings } from "@/lib/strings";

import styles from "./DataTable.module.css";
import { Clipped, columnStyle, ExternalLink } from "./TableParts";

const text = strings.postings;

const COLUMNS: readonly { label: string; width: string | null }[] = [
  { label: text.columns.posting, width: null },
  { label: text.columns.location, width: "--col-posting-location" },
  { label: text.columns.firstSeen, width: "--col-first-seen" },
  { label: text.columns.lastSeen, width: "--col-last-seen" },
  { label: text.columns.status, width: "--col-posting-status" },
];

function statusLabel(posting: Posting): string {
  switch (posting.status) {
    case "applied":
      return posting.applied_on
        ? text.status.applied(formatDayMonth(posting.applied_on))
        : text.status.appliedNoDate;
    case "saved":
      return text.status.saved;
    case "new":
      return text.status.new;
  }
}

function Row({ posting }: { posting: Posting }) {
  const company = posting.company ?? strings.applications.noCompany;
  return (
    <tr>
      <td>
        <Clipped value={posting.title ?? strings.applications.noTitle} className={styles.company} />
        <Clipped value={company} className={styles.title} />
      </td>
      <td>
        <Clipped value={posting.location ?? strings.applications.unknown} className={styles.secondary} />
      </td>
      <td>
        <Clipped value={formatDayMonth(posting.first_seen_date)} className={styles.mono} />
      </td>
      <td>
        <Clipped value={formatDayMonth(posting.last_seen_date)} className={styles.mono} />
        <Clipped value={text.mentions(posting.mention_count)} className={styles.ago} />
      </td>
      <td>
        <Clipped
          value={statusLabel(posting)}
          className={posting.status === "new" ? styles.secondary : undefined}
        />
      </td>
      <td className={styles.linkCell}>
        <ExternalLink href={posting.posting_url} label={strings.applications.openPosting(company)} />
      </td>
    </tr>
  );
}

export function PostingTable({ postings, footer }: { postings: Posting[]; footer: ReactNode }) {
  return (
    <div className={styles.panel}>
      <div className={styles.scroll}>
        <table className={styles.table} style={{ minWidth: "var(--postings-min-width)" }}>
          <colgroup>
            {COLUMNS.map((column) => (
              <col key={column.label} style={columnStyle(column.width)} />
            ))}
            <col style={columnStyle("--col-link")} />
          </colgroup>
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th key={column.label} scope="col">
                  {column.label}
                </th>
              ))}
              <td aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {postings.map((posting) => (
              <Row key={posting.posting_key} posting={posting} />
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
