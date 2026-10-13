// The incoming-postings list: same table style as the application list. The
// status is plain text as in the mockup; role type, rough fit, and the match
// report join as columns in later phases.
import { formatDayMonth } from "@/lib/format";
import type { Posting } from "@/lib/postings";
import { strings } from "@/lib/strings";

import styles from "./DataTable.module.css";
import { Clipped, ExternalLink, TableHead, type TableShape, type TableSorting } from "./TableParts";

const text = strings.postings;

export const POSTING_TABLE: TableShape = {
  columns: [
    { label: text.columns.posting, width: null },
    { label: text.columns.location, width: "--col-posting-location" },
    { label: text.columns.firstSeen, width: "--col-first-seen", sortKey: "first_seen" },
    { label: text.columns.lastSeen, width: "--col-last-seen", sortKey: "last_seen" },
    { label: text.columns.status, width: "--col-posting-status" },
  ],
  minWidth: "--postings-min-width",
};

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

export function PostingTable({
  postings,
  sorting,
}: {
  postings: Posting[];
  sorting: TableSorting;
}) {
  return (
    <div className={styles.scroll}>
      <table className={styles.table} style={{ minWidth: `var(${POSTING_TABLE.minWidth})` }}>
        <TableHead shape={POSTING_TABLE} sorting={sorting} />
        <tbody>
          {postings.map((posting) => (
            <Row key={posting.posting_key} posting={posting} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
