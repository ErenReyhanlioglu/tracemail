// Cell strips and their legend (ADR-0044). Every strip uses one vocabulary;
// the cells are decorative for assistive technology, which reads the
// strip's summary instead: its window and the count of each state.
import type { CellState } from "@/lib/panel";
import { countCells } from "@/lib/panel";
import { strings } from "@/lib/strings";

import styles from "./HealthPanel.module.css";

const ORDER: CellState[] = ["ok", "skipped", "late", "failed", "none"];
// The words a strip's states read as; a section may name them its own way.
export type CellWords = Partial<Record<CellState, string>>;
const defaultWords: CellWords = strings.health.cells;

export function summary(window: string, cells: CellState[], words = defaultWords): string {
  const counts = countCells(cells);
  const parts = ORDER.filter((state) => counts[state] > 0).map(
    (state) => `${counts[state]} ${words[state] ?? ""}`,
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

export function CellLegend({ words = defaultWords }: { words?: CellWords }) {
  return (
    <ul className={styles.legend}>
      {ORDER.filter((state) => words[state] !== undefined).map((state) => (
        <li key={state}>
          <span className={`${styles.swatch} ${styles[state]}`} aria-hidden="true" />
          {words[state]}
        </li>
      ))}
    </ul>
  );
}
