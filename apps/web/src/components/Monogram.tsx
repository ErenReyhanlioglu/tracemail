// A company's monogram tile (ADR-0052); its hue is set per company, its
// lightness per theme (DataTable.module.css). Decorative: the company's
// name is read beside it.
import type { CSSProperties } from "react";

import { monogramHue, monogramInitial } from "@/lib/monogram";

import styles from "./DataTable.module.css";

// An unknown company gets one fixed grey tile with a question mark, so the
// row keeps its shape and reads as "not known" rather than as a company.
const UNKNOWN_MARK = "?";

export function Monogram({ name }: { name: string | null }) {
  const initial = name ? monogramInitial(name) : "";
  if (!name || !initial) {
    return (
      <span className={`${styles.monogram} ${styles.monogramBlank}`} aria-hidden="true">
        {UNKNOWN_MARK}
      </span>
    );
  }
  const style = { "--mono-hue": monogramHue(name) } as CSSProperties;
  return (
    <span className={styles.monogram} style={style} aria-hidden="true">
      {initial}
    </span>
  );
}
