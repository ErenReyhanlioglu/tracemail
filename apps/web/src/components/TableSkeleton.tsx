// A list's loading state in the shape of its panel (content-only skeleton,
// NN/g): the toolbar with placeholder segments (and the period menu) and
// search, the real column headers, placeholder rows, and the pagination
// bar. Screen readers hear one status message instead of the placeholders.
import { strings } from "@/lib/strings";

import tableStyles from "./DataTable.module.css";
import panelStyles from "./ListPanel.module.css";
import { TableHead, type TableShape, tableStyle } from "./TableParts";
import styles from "./TableSkeleton.module.css";

const ROWS = 8;

// The placeholder cells carry the real rows' phone roles (ADR-0047): the
// first is the position, the last two the date and status, the rest hide.
function phoneRole(cell: number, cells: number): string | undefined {
  if (cell === cells - 2) {
    return tableStyles.cellStatus;
  }
  return cell === cells - 3 ? tableStyles.cellDate : tableStyles.cellExtra;
}

function Row({ shape }: { shape: TableShape }) {
  const cells = shape.columns.length;
  return (
    <tr>
      <td className={tableStyles.cellMain}>
        <span className={`${styles.bar} ${styles.wide}`} />
        <span className={`${styles.bar} ${styles.wider}`} />
      </td>
      {shape.columns.slice(1).map((column, cell) => (
        <td
          key={column.label}
          className={`${phoneRole(cell, cells) ?? ""} ${column.droppable ? tableStyles.droppable : ""}`}
        >
          <span className={`${styles.bar} ${styles.short}`} />
        </td>
      ))}
      <td className={tableStyles.linkCell} />
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
          <table className={tableStyles.table} style={tableStyle(shape)}>
            <TableHead shape={shape} />
            <tbody className={styles.delayed}>
              {Array.from({ length: ROWS }, (_, row) => (
                <Row key={row} shape={shape} />
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.footer} />
      </div>
    </div>
  );
}
