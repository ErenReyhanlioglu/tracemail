// A list's panel (ADR-0042): its filters in a toolbar on top, then the
// table or a no-match message, then the pagination bar, so the controls sit
// with the rows they filter (Carbon's table toolbar). The start holds the
// filters; the end holds clearing and the search.
import type { ReactNode } from "react";

import styles from "./ListPanel.module.css";

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
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.start}>{start}</div>
        {end ? <div className={styles.end}>{end}</div> : null}
      </div>
      {children}
      {footer}
    </div>
  );
}
