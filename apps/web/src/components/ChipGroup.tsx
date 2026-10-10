// A row of filter chips as links, so list pages stay server components and
// every filtered view has its own URL. An optional label names the group.
import Link from "next/link";

import styles from "./ChipGroup.module.css";

export interface Chip {
  key: string;
  label: string;
  href: string;
  active: boolean;
  count?: number;
}

export function ChipGroup({ label, chips }: { label?: string; chips: Chip[] }) {
  return (
    <div className={styles.group}>
      {label ? <span className={styles.groupLabel}>{label}</span> : null}
      <ul className={styles.chips}>
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link
              href={chip.href}
              className={chip.active ? `${styles.chip} ${styles.active}` : styles.chip}
              aria-current={chip.active ? "page" : undefined}
            >
              {chip.label}
              {chip.count === undefined ? null : (
                <span className={styles.count}>{chip.count}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
