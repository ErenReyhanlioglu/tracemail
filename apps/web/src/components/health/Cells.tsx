// Cell strips and their legend (ADR-0044). Every strip uses one vocabulary;
// the cells are decorative for assistive technology, which reads the
// strip's summary instead: its window and the count of each state.
import type { CellState } from "@/lib/panel";
import { countCells } from "@/lib/panel";
import { strings } from "@/lib/strings";

import styles from "./HealthPanel.module.css";

const words = strings.health.cells;
const ORDER: CellState[] = ["ok", "skipped", "late", "failed", "none"];

export function summary(window: string, cells: CellState[]): string {
  const counts = countCells(cells);
  const parts = ORDER.filter((state) => counts[state] > 0).map(
    (state) => `${counts[state]} ${words[state]}`,
  );
  return [window, ...parts].join(", ");
}

export function Strip({
  cells,
  label,
  tall = false,
}: {
  cells: CellState[];
  label: string;
  tall?: boolean;
}) {
  return (
    <div className={`${styles.strip} ${tall ? styles.tall : ""}`} role="img" aria-label={label}>
      {cells.map((cell, index) => (
        <span key={index} className={`${styles.cell} ${styles[cell]}`} />
      ))}
    </div>
  );
}

export function CellLegend() {
  return (
    <ul className={styles.legend}>
      {ORDER.map((state) => (
        <li key={state}>
          <span className={`${styles.swatch} ${styles[state]}`} aria-hidden="true" />
          {words[state]}
        </li>
      ))}
    </ul>
  );
}
