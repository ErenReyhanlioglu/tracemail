// Filters as links (?filter=...), so the page stays a server component and
// every filtered view has its own URL. A filter opens its first page and
// keeps the chosen page size.
import Link from "next/link";

import { FILTERS, type Filter } from "@/lib/applications";
import { listUrl, type PageSize } from "@/lib/paging";
import { strings } from "@/lib/strings";

import styles from "./FilterChips.module.css";

const LABELS: Record<Filter, string> = {
  all: strings.applications.filters.all,
  in_progress: strings.applications.filters.inProgress,
  silent: strings.applications.filters.silent,
  rejected: strings.applications.filters.rejected,
};

export function FilterChips({
  active,
  size,
  counts,
}: {
  active: Filter;
  size: PageSize;
  counts: Record<Filter, number>;
}) {
  return (
    <ul className={styles.chips}>
      {FILTERS.map((filter) => (
        <li key={filter}>
          <Link
            href={listUrl({ filter, page: 1, size })}
            className={filter === active ? `${styles.chip} ${styles.active}` : styles.chip}
            aria-current={filter === active ? "page" : undefined}
          >
            {LABELS[filter]}
            <span className={styles.count}>{counts[filter]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
