// Sorting a list by one of its date columns (ADR-0042), kept in the URL as
// ?sort=<key>&order=asc|desc. Clicking the sorted column flips its order;
// clicking another column sorts by it, newest first.

export type SortOrder = "asc" | "desc";

export interface Sort<K extends string> {
  key: K;
  order: SortOrder;
}

export function parseSort<K extends string>(
  keys: readonly K[],
  fallback: Sort<K>,
  key: string | undefined,
  order: string | undefined,
): Sort<K> {
  return {
    key: keys.find((option) => option === key) ?? fallback.key,
    order: order === "asc" || order === "desc" ? order : fallback.order,
  };
}

// The sort's URL parameters, omitted when it is the list's default.
export function sortQuery<K extends string>(sort: Sort<K>, fallback: Sort<K>): Record<string, string> {
  const query: Record<string, string> = {};
  if (sort.key !== fallback.key) {
    query.sort = sort.key;
  }
  if (sort.order !== fallback.order) {
    query.order = sort.order;
  }
  return query;
}

export function nextSort<K extends string>(current: Sort<K>, key: K): Sort<K> {
  if (current.key === key) {
    return { key, order: current.order === "desc" ? "asc" : "desc" };
  }
  return { key, order: "desc" };
}
