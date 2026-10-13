// Pagination bar attached to the bottom of the table, always shown: rows per
// page and the item range on the left; previous, page links, and next on the
// right, as in common data-table footers (Carbon's pagination anatomy). Page
// links are truncated as in GitHub Primer (first and last page, two on each
// side of the current one, an ellipsis for longer gaps).
import Link from "next/link";

import { type ListLocation, listUrl, pageCount, pageItems, type PageSize } from "@/lib/paging";
import { strings } from "@/lib/strings";

import { PageSizeSelect } from "./PageSizeSelect";
import styles from "./Pagination.module.css";

const text = strings.pagination;

function Chevron({ direction }: { direction: "left" | "right" }) {
  const path = direction === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6";
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.chevron}>
      <path d={path} />
    </svg>
  );
}

function Step({
  href,
  direction,
  label,
}: {
  href: string | null;
  direction: "left" | "right";
  label: string;
}) {
  if (href === null) {
    // Kept for a stable layout; it does nothing, so assistive technology
    // skips it rather than announcing a control that cannot be used.
    return (
      <span className={`${styles.step} ${styles.disabled}`} aria-hidden="true">
        <Chevron direction={direction} />
      </span>
    );
  }
  return (
    <Link
      className={styles.step}
      href={href}
      rel={direction === "left" ? "prev" : "next"}
      aria-label={label}
      title={label}
    >
      <Chevron direction={direction} />
    </Link>
  );
}

export function Pagination({
  location,
  page,
  size,
  total,
  noun,
}: {
  location: ListLocation;
  page: number;
  size: PageSize;
  total: number;
  noun: string;
}) {
  const pages = pageCount(total, size);
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  const at = (target: number) => listUrl(location, target, size);
  return (
    <nav className={styles.bar} aria-label={text.label}>
      <div className={styles.side}>
        <PageSizeSelect location={location} size={size} />
        <span className={styles.range}>{text.range(from, to, total, noun)}</span>
      </div>
      <div className={styles.side}>
        <Step href={page > 1 ? at(page - 1) : null} direction="left" label={text.previous} />
        <ol className={styles.pages}>
          {pageItems(page, pages).map((item) =>
            item.kind === "gap" ? (
              <li key={`gap-${item.after}`} className={styles.gap} aria-label={text.gap}>
                …
              </li>
            ) : (
              <li key={item.page}>
                <Link
                  className={item.page === page ? `${styles.number} ${styles.current}` : styles.number}
                  href={at(item.page)}
                  aria-label={text.goToPage(item.page)}
                  aria-current={item.page === page ? "page" : undefined}
                >
                  {item.page}
                </Link>
              </li>
            ),
          )}
        </ol>
        <Step href={page < pages ? at(page + 1) : null} direction="right" label={text.next} />
      </div>
    </nav>
  );
}
