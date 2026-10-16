"use client";

// A sort control's icon (ADR-0049). While its own link is the pending sort,
// it already shows the order the click leads to; while another column's
// sort is pending, it shows as unsorted; otherwise the current order.
import type { SortOrder } from "@/lib/sorting";

import { SortableIcon, SortDownIcon, SortUpIcon } from "./icons/NavIcons";
import { usePendingTarget } from "./navigation/Pending";

export const SORT_GROUP = "sort";

export function SortIcon({
  href,
  order,
  nextOrder,
  className,
  idleClassName,
}: {
  href: string;
  // The current order by this control's column, or null if not sorted by it.
  order: SortOrder | null;
  nextOrder: SortOrder;
  // A wrapper's class, and the class it adds while the column is unsorted.
  className?: string;
  idleClassName?: string;
}) {
  const target = usePendingTarget(SORT_GROUP);
  const shown = target === null ? order : target === href ? nextOrder : null;
  const icon =
    shown === null ? <SortableIcon /> : shown === "desc" ? <SortDownIcon /> : <SortUpIcon />;
  if (className === undefined) {
    return icon;
  }
  return (
    <span className={shown === null && idleClassName ? `${className} ${idleClassName}` : className}>
      {icon}
    </span>
  );
}
