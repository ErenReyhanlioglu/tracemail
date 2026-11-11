// The incoming-postings list: same table style as the application list. The
// status is a badge (ADR-0052): new in the accent, saved in amber, applied
// in green; the match report joins as a column in a later phase. On phones
// each row is a card that opens the posting (ADR-0052): the monogram, then
// the position over the company and location on the left, the last
// sighting with its alert count over the status on the right.
import { formatDayMonth } from "@/lib/format";
import type { Posting } from "@/lib/postings";
import { postingBadge } from "@/lib/status";
import { strings } from "@/lib/strings";

import styles from "./DataTable.module.css";
import { BellIcon } from "./icons/NavIcons";
import { Monogram } from "./Monogram";
import { StatusBadge } from "./StatusBadge";
import {
  Clipped,
  ExternalLink,
  TableHead,
  type TableShape,
  type TableSorting,
  tableStyle,
} from "./TableParts";

const text = strings.postings;
// From this many alert mails a posting's count stands out (as in the v2
// mockup): the same posting kept coming back.
const MANY_MENTIONS = 3;

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
      <td className={styles.cellMain}>
        <div className={styles.withMark}>
          <Monogram name={posting.company} />
          <div className={styles.names}>
            <Clipped value={posting.title ?? strings.applications.noTitle} className={styles.lead} />
            {/* Phones add the location after the company (ADR-0052). */}
            <span className={`${styles.clip} ${styles.sub}`} title={company}>
              {company}
              {posting.location ? (
                <span className={styles.inlinePlace}>
                  {" · "}
                  {posting.location}
                </span>
              ) : null}
            </span>
          </div>
        </div>
      </td>
      <td className={styles.cellExtra}>
        <Clipped value={posting.location ?? strings.applications.unknown} className={styles.secondary} />
      </td>
      <td className={styles.cellExtra}>
        <Clipped value={formatDayMonth(posting.first_seen_date)} className={styles.mono} />
      </td>
      <td className={styles.cellDate}>
        {/* The date and a bell with the alert count on one line
            (ADR-0052). */}
        <div className={styles.dateLine}>
          <Clipped value={formatDayMonth(posting.last_seen_date)} className={styles.mono} />
          <span
            className={
              posting.mention_count >= MANY_MENTIONS
                ? `${styles.mentions} ${styles.mentionsMany}`
                : styles.mentions
            }
            title={text.mentions(posting.mention_count)}
          >
            <BellIcon />
            <span aria-hidden="true">{posting.mention_count}</span>
            <span className="visually-hidden">{text.mentions(posting.mention_count)}</span>
          </span>
        </div>
      </td>
      <td className={styles.cellStatus}>
        <StatusBadge badge={postingBadge(posting, statusLabel(posting))} />
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
      <table className={`${styles.table} ${styles.cards}`} style={tableStyle(POSTING_TABLE)}>
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
