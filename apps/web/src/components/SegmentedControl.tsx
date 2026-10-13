// One choice from a few mutually exclusive options that filter a list, with
// a count per option (Primer's SegmentedControl, ADR-0042). Each option is a
// link, since the choice lives in the URL; the selected one is marked with
// aria-current and shown by background and weight together.
import Link from "next/link";

import styles from "./SegmentedControl.module.css";

export interface Segment {
  key: string;
  label: string;
  href: string;
  selected: boolean;
  count?: number;
}

export function SegmentedControl({ label, segments }: { label: string; segments: Segment[] }) {
  return (
    <nav aria-label={label}>
      <ul className={styles.control}>
        {segments.map((segment) => (
          <li key={segment.key}>
            <Link
              href={segment.href}
              className={segment.selected ? `${styles.segment} ${styles.selected}` : styles.segment}
              aria-current={segment.selected ? "page" : undefined}
            >
              {segment.label}
              {segment.count === undefined ? null : (
                <span className={styles.count}>{segment.count}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
