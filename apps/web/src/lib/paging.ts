// Paging shared by the list pages: page sizes, which page links to show,
// and list URLs that keep a page's own query (filter, period) alongside the
// page number and page size.

export const PAGE_SIZES = [10, 20, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 20;
// Page links kept at each end and on each side of the current page, as in
// GitHub Primer's pagination (marginPageCount 1, surroundingPageCount 2).
export const MARGIN_PAGES = 1;
export const SURROUNDING_PAGES = 2;

export type PageItem = { kind: "page"; page: number } | { kind: "gap"; after: number };

// A list page's address: its path and the query that selects its rows.
export interface ListLocation {
  path: string;
  query: Record<string, string>;
}

export function parsePageSize(value: string | undefined): PageSize {
  return PAGE_SIZES.find((size) => String(size) === value) ?? DEFAULT_PAGE_SIZE;
}

export function pageCount(total: number, size: PageSize): number {
  return Math.max(1, Math.ceil(total / size));
}

export function parsePage(value: string | undefined, pages: number): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 && page <= pages ? page : 1;
}

export function pageSlice<T>(items: T[], page: number, size: PageSize): T[] {
  const start = (page - 1) * size;
  return items.slice(start, start + size);
}

function isShown(page: number, current: number, pages: number): boolean {
  return (
    page <= MARGIN_PAGES ||
    page > pages - MARGIN_PAGES ||
    Math.abs(page - current) <= SURROUNDING_PAGES
  );
}

// Page links with gaps: a gap of exactly one page shows that page instead of
// an ellipsis, so an ellipsis always hides at least two pages.
export function pageItems(current: number, pages: number): PageItem[] {
  const shown = Array.from({ length: pages }, (_, index) => index + 1).filter((page) =>
    isShown(page, current, pages),
  );
  const items: PageItem[] = [];
  let previous = 0;
  for (const page of shown) {
    if (page - previous === 2) {
      items.push({ kind: "page", page: page - 1 });
    } else if (page - previous > 2) {
      items.push({ kind: "gap", after: previous });
    }
    items.push({ kind: "page", page });
    previous = page;
  }
  return items;
}

// The page-size parameter, when it differs from the default, for links and
// forms that keep it.
export function sizeQuery(size: PageSize): Record<string, string> {
  return size === DEFAULT_PAGE_SIZE ? {} : { size: String(size) };
}

export function listUrl(location: ListLocation, page: number, size: PageSize): string {
  const params = new URLSearchParams(location.query);
  if (page > 1) {
    params.set("page", String(page));
  }
  if (size !== DEFAULT_PAGE_SIZE) {
    params.set("size", String(size));
  }
  const query = params.toString();
  return query ? `${location.path}?${query}` : location.path;
}
