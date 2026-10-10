"use client";

// Rows-per-page selector. Changing it opens the first page of the same list
// with the new size; the choice lives in the URL (?size=).
import { useRouter } from "next/navigation";

import { type ListLocation, listUrl, PAGE_SIZES, type PageSize, parsePageSize } from "@/lib/paging";
import { strings } from "@/lib/strings";

import styles from "./Pagination.module.css";

export function PageSizeSelect({ location, size }: { location: ListLocation; size: PageSize }) {
  const router = useRouter();
  return (
    <label className={styles.sizeLabel}>
      {strings.pagination.perPage}
      <span className={styles.selectWrap}>
        <select
          className={styles.select}
          value={size}
          onChange={(event) =>
            router.push(listUrl(location, 1, parsePageSize(event.target.value)))
          }
        >
          {PAGE_SIZES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}
