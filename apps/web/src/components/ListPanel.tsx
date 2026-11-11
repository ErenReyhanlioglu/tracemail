// A list's panel (ADR-0042): its filters in a toolbar on top, then the
// table or a no-match message, then the pagination bar, so the controls sit
// with the rows they filter (Carbon's table toolbar). The start holds the
// tabs and the period and sort menus; the end holds the search. Every
// control in the panel answers a click at once, and the rows dim while a
// slow answer loads (ADR-0049).
import type { ReactNode } from "react";

import styles from "./ListPanel.module.css";
import { PendingContent, PendingNavigation } from "./navigation/Pending";
import { ScrollRow } from "./ScrollRow";

export function ListPanel({
  start,
  end,
  footer,
  children,
}: {
  start: ReactNode;
  end?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PendingNavigation>
      <div className={styles.panel}>
        <div className={styles.toolbar}>
          {/* The wrapper carries the filter row's edge fades on phones. */}
          <div className={styles.startWrap}>
            <ScrollRow className={styles.start}>{start}</ScrollRow>
          </div>
          {end ? <div className={styles.end}>{end}</div> : null}
        </div>
        {/* On wide screens the rows scroll inside this part alone, between
            the toolbar and the pagination bar (ADR-0052). */}
        <div className={styles.body}>
          <PendingContent>{children}</PendingContent>
        </div>
        {footer}
      </div>
    </PendingNavigation>
  );
}
