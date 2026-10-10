// A status badge: text that carries the meaning, color that supports it
// (WCAG 1.4.1; ADR-0034).
import type { Badge } from "@/lib/status";

import styles from "./StatusBadge.module.css";

export function StatusBadge({ badge }: { badge: Badge }) {
  return <span className={`${styles.badge} ${styles[badge.tone]}`}>{badge.label}</span>;
}
