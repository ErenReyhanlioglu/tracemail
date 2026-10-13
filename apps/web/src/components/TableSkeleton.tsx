// A list's loading state in the shape of its panel (content-only skeleton,
// NN/g): the toolbar with placeholder segments (and the period menu) and
// search, the real column headers, placeholder rows, and the pagination
// bar. Screen readers hear one status message instead of the placeholders.
import { strings } from "@/lib/strings";

import tableStyles from "./DataTable.module.css";
import panelStyles from "./ListPanel.module.css";
import { TableHead, type TableShape } from "./TableParts";
import styles from "./TableSkeleton.module.css";

const ROWS = 8;

function Row({ cells }: { cells: number }) {
  return (
    <tr>
      <td>
        <span className={`${styles.bar} ${styles.wide}`} />
        <span className={`${styles.bar} ${styles.wider}`} />
      </td>
      {Array.from({ length: cells - 1 }, (_, cell) => (
        <td key={cell}>
          <span className={`${styles.bar} ${styles.short}`} />
        </td>
      ))}
      <td />
    </tr>
  );
}

export function TableSkeleton({
  shape,
  segments,
  menu,
}: {
  shape: TableShape;
  segments: number;
  menu: boolean;
}) {
  return (
    <div role="status">
      <span className="visually-hidden">{strings.states.loading}</span>
      <div aria-hidden="true" className={panelStyles.panel}>
        <div className={`${panelStyles.toolbar} ${styles.delayed}`}>
          <div className={panelStyles.start}>
            <span className={styles.segments}>
              {Array.from({ length: segments }, (_, segment) => (
                <span key={segment} className={styles.segment} />
              ))}
            </span>
            {menu ? <span className={styles.menu} /> : null}
          </div>
          <div className={panelStyles.end}>
            <span className={styles.search} />
          </div>
        </div>
        <div className={tableStyles.scroll}>
          <table className={tableStyles.table} style={{ minWidth: `var(${shape.minWidth})` }}>
            <TableHead shape={shape} />
            <tbody className={styles.delayed}>
              {Array.from({ length: ROWS }, (_, row) => (
                <Row key={row} cells={shape.columns.length} />
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.footer} />
      </div>
    </div>
  );
}
