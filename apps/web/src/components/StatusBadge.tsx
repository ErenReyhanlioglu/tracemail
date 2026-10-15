// A status badge: text that carries the meaning, color that supports it
// (WCAG 1.4.1; ADR-0034).
import type { Badge } from "@/lib/status";

import styles from "./StatusBadge.module.css";

export function StatusBadge({ badge }: { badge: Badge }) {
  const className = `${styles.badge} ${styles[badge.tone]}`;
  if (!badge.spoken) {
    return <span className={className}>{badge.label}</span>;
  }
  return (
    <span className={className} title={badge.spoken}>
      <span aria-hidden="true">{badge.label}</span>
      <span className="visually-hidden">{badge.spoken}</span>
    </span>
  );
}
