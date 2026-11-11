// A status badge (ADR-0052): a dot, the label that carries the meaning, and
// the color that supports it (WCAG 1.4.1; ADR-0034). An application's days
// of silence sit inside, after the label, in the attention color.
import type { Badge } from "@/lib/status";

import styles from "./StatusBadge.module.css";

export function StatusBadge({ badge }: { badge: Badge }) {
  return (
    <span className={`${styles.badge} ${styles[badge.tone]}`} title={badge.silence?.spoken}>
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.label}>{badge.label}</span>
      {badge.silence ? (
        <span className={styles.silence}>
          <span aria-hidden="true">· {badge.silence.label}</span>
          <span className="visually-hidden">, {badge.silence.spoken}</span>
        </span>
      ) : null}
    </span>
  );
}
