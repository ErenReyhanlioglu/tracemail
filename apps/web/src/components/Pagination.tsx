// Pagination bar attached to the bottom of the table, always shown: rows per
// page and the item range on the left; previous, page links, and next on the
// right, as in common data-table footers (Carbon's pagination anatomy). Page
// links are truncated as in GitHub Primer (first and last page, two on each
// side of the current one, an ellipsis for longer gaps). A clicked page shows
// as current at once, and focus moves to the new rows (ADR-0049).

import {
  type ListLocation,
  listUrl,
  pageCount,
  type PageItem,
  pageItems,
  type PageSize,
} from "@/lib/paging";
import { strings } from "@/lib/strings";

import { PendingLink } from "./navigation/Pending";
import { PageSizeSelect } from "./PageSizeSelect";
import styles from "./Pagination.module.css";

const text = strings.pagination;
const GROUP = "page";

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
    <PendingLink
      className={styles.step}
      href={href}
      group={GROUP}
      focusList={true}
      rel={direction === "left" ? "prev" : "next"}
      aria-label={label}
      title={label}
    >
      <Chevron direction={direction} />
    </PendingLink>
  );
}

// One window of page links; the wide and the phone window are both rendered
// and CSS shows one (ADR-0047).
function PageLinks({
  items,
  page,
  at,
  className,
}: {
  items: PageItem[];
  page: number;
  at: (target: number) => string;
  className: string | undefined;
}) {
  return (
    <ol className={`${styles.pages} ${className ?? ""}`}>
      {items.map((item) =>
        item.kind === "gap" ? (
          <li key={`gap-${item.after}`} className={styles.gap} aria-label={text.gap}>
            …
          </li>
        ) : (
          <li key={item.page}>
            <PendingLink
              className={styles.number}
              selectedClassName={`${styles.number} ${styles.current}`}
              href={at(item.page)}
              group={GROUP}
              selected={item.page === page}
              current="page"
              focusList={true}
              aria-label={text.goToPage(item.page)}
            >
              {item.page}
            </PendingLink>
          </li>
        ),
      )}
    </ol>
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
        <PageLinks items={pageItems(page, pages)} page={page} at={at} className={styles.wide} />
        <PageLinks
          items={pageItems(page, pages, true)}
          page={page}
          at={at}
          className={styles.phone}
        />
        <Step href={page < pages ? at(page + 1) : null} direction="right" label={text.next} />
      </div>
    </nav>
  );
}
