// Cell parts shared by the list tables: one-line text cut with an ellipsis
// (full value on hover) and the external posting link.
import type { CSSProperties } from "react";

import styles from "./DataTable.module.css";

export function Clipped({ value, className }: { value: string; className?: string }) {
  return (
    <span className={className ? `${styles.clip} ${className}` : styles.clip} title={value}>
      {value}
    </span>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

export function ExternalLink({ href, label }: { href: string | null; label: string }) {
  if (!href) {
    return null;
  }
  return (
    <a
      className={styles.link}
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      title={label}
    >
      <ExternalIcon />
    </a>
  );
}

// A fixed column width from a design token; the column without one takes
// the remaining width.
export function columnStyle(token: string | null): CSSProperties | undefined {
  return token ? { width: `var(${token})` } : undefined;
}
