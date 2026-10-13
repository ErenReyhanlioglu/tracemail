// Parts shared by the list tables: the column header (sortable columns as
// links, the sorted one marked, as in Carbon's tables), one-line text cut
// with an ellipsis (full value on hover), and the external posting link.
import Link from "next/link";
import type { CSSProperties } from "react";

import type { SortOrder } from "@/lib/sorting";
import { strings } from "@/lib/strings";

import styles from "./DataTable.module.css";
import { SortableIcon, SortDownIcon, SortUpIcon } from "./icons/NavIcons";

export function Clipped({ value, className }: { value: string; className?: string }) {
  return (
    <span className={className ? `${styles.clip} ${className}` : styles.clip} title={value}>
      {value}
    </span>
  );
}

export function ExternalIcon() {
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

// A list table's columns and minimum width, shared with its loading
// skeleton so both have the same shape.
export interface Column {
  label: string;
  width: string | null;
  // Set on columns the list can be sorted by (ADR-0042).
  sortKey?: string;
}

export interface TableShape {
  columns: readonly Column[];
  minWidth: string;
}

// A fixed column width from a design token; the column without one takes
// the remaining width.
export function columnStyle(token: string | null): CSSProperties | undefined {
  return token ? { width: `var(${token})` } : undefined;
}

// How a table is sorted now, and where each sortable column's header leads.
export interface TableSorting {
  key: string;
  order: SortOrder;
  hrefs: Record<string, string>;
}

function SortLink({ column, sorting }: { column: Column; sorting: TableSorting }) {
  const key = column.sortKey ?? "";
  const current = sorting.key === key;
  return (
    <Link href={sorting.hrefs[key] ?? "#"} className={styles.sortLink} scroll={false}>
      {column.label}
      <span className="visually-hidden">, {strings.table.sortHint}</span>
      <span className={current ? styles.sortIcon : `${styles.sortIcon} ${styles.sortHint}`}>
        {!current ? <SortableIcon /> : sorting.order === "desc" ? <SortDownIcon /> : <SortUpIcon />}
      </span>
    </Link>
  );
}

function ariaSort(column: Column, sorting?: TableSorting): "ascending" | "descending" | undefined {
  if (!sorting || column.sortKey !== sorting.key) {
    return undefined;
  }
  return sorting.order === "desc" ? "descending" : "ascending";
}

// Column widths and header row; the last, unlabeled column holds the link.
// Sortable columns link to their next sort (Carbon's sortable headers).
export function TableHead({ shape, sorting }: { shape: TableShape; sorting?: TableSorting }) {
  return (
    <>
      <colgroup>
        {shape.columns.map((column) => (
          <col key={column.label} style={columnStyle(column.width)} />
        ))}
        <col style={columnStyle("--col-link")} />
      </colgroup>
      <thead>
        <tr>
          {shape.columns.map((column) => {
            const sorted = ariaSort(column, sorting);
            return (
              <th
                key={column.label}
                scope="col"
                aria-sort={sorted}
                className={sorted ? styles.sorted : undefined}
              >
                {column.sortKey && sorting ? (
                  <SortLink column={column} sorting={sorting} />
                ) : (
                  column.label
                )}
              </th>
            );
          })}
          <td aria-hidden="true" />
        </tr>
      </thead>
    </>
  );
}
