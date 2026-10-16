"use client";

// Rows-per-page selector. Changing it opens the first page of the same list
// with the new size; the choice lives in the URL (?size=). The select keeps
// the new choice while the list loads (ADR-0049), and shows the URL's size
// again whenever that changes.
import { useRouter } from "next/navigation";

import { type ListLocation, listUrl, PAGE_SIZES, type PageSize, parsePageSize } from "@/lib/paging";
import { strings } from "@/lib/strings";

import { useNavigate } from "./navigation/Pending";
import styles from "./Pagination.module.css";

export function PageSizeSelect({ location, size }: { location: ListLocation; size: PageSize }) {
  const router = useRouter();
  const navigate = useNavigate();
  function choose(value: string): void {
    const href = listUrl(location, 1, parsePageSize(value));
    if (navigate) {
      navigate(href, { group: "size" });
    } else {
      router.push(href);
    }
  }
  return (
    <label className={styles.sizeLabel}>
      {strings.pagination.perPage}
      <span className={styles.selectWrap}>
        <select
          name="pageSize"
          className={styles.select}
          key={size}
          defaultValue={size}
          onChange={(event) => choose(event.target.value)}
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
