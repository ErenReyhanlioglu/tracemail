// Phones only (ADR-0047): above the rows, a way back to the full list once
// it is filtered, and the list's order. The order control sorts by the one
// date a phone row shows; a tap reverses it. The filter chips carry the
// counts, so the line shows none. A tap shows the new order at once
// (ADR-0049).
import type { SortOrder } from "@/lib/sorting";
import { strings } from "@/lib/strings";

import styles from "./ListPanel.module.css";
import { PendingLink } from "./navigation/Pending";
import { SORT_GROUP, SortIcon } from "./SortIcon";

export function ListSummary({
  clearHref,
  clearLabel,
  sortLabel,
  sortHref,
  order,
  nextOrder,
}: {
  // Null while nothing is filtered.
  clearHref: string | null;
  clearLabel: string;
  sortLabel: string;
  sortHref: string;
  // The order by this date, or null while the list is sorted by another.
  order: SortOrder | null;
  // The order a tap leads to.
  nextOrder: SortOrder;
}) {
  return (
    <div className={styles.summary}>
      {clearHref === null ? (
        <span />
      ) : (
        <PendingLink href={clearHref} group="clear" className={styles.summaryClear}>
          {clearLabel}
        </PendingLink>
      )}
      <PendingLink href={sortHref} group={SORT_GROUP} className={styles.sortToggle} scroll={false}>
        {sortLabel}
        <span className="visually-hidden">, {strings.table.sortHint}</span>
        <SortIcon href={sortHref} order={order} nextOrder={nextOrder} />
      </PendingLink>
    </div>
  );
}
