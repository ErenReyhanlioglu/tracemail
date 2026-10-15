// Phones only (ADR-0047): above the rows, a way back to the full list once
// it is filtered, and the list's order. The order control sorts by the one
// date a phone row shows; a tap reverses it. The filter chips carry the
// counts, so the line shows none.
import Link from "next/link";

import { strings } from "@/lib/strings";

import { SortableIcon, SortDownIcon, SortUpIcon } from "./icons/NavIcons";
import styles from "./ListPanel.module.css";

export function ListSummary({
  clearHref,
  clearLabel,
  sortLabel,
  sortHref,
  order,
}: {
  // Null while nothing is filtered.
  clearHref: string | null;
  clearLabel: string;
  sortLabel: string;
  sortHref: string;
  // The order by this date, or null while the list is sorted by another.
  order: "asc" | "desc" | null;
}) {
  return (
    <div className={styles.summary}>
      {clearHref === null ? (
        <span />
      ) : (
        <Link href={clearHref} className={styles.summaryClear}>
          {clearLabel}
        </Link>
      )}
      <Link href={sortHref} className={styles.sortToggle} scroll={false}>
        {sortLabel}
        <span className="visually-hidden">, {strings.table.sortHint}</span>
        {order === null ? <SortableIcon /> : order === "desc" ? <SortDownIcon /> : <SortUpIcon />}
      </Link>
    </div>
  );
}
