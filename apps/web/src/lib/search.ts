// Free-text search over a list's title and company (ADR-0042). Matching
// ignores case and Turkish letters: accents are dropped and dotless and
// dotted i are both plain i, so "basvuru" finds "Başvuru" and "ai" finds
// "AI". Every word of the query must appear. The API applies the same rule
// to the incoming-postings list (tracemail_api/search.py); the two must stay
// in step.

export const SEARCH_PARAM = "q";
export const MAX_QUERY_LENGTH = 100;
// Pause after the last keystroke before searching as the owner types.
export const SEARCH_DEBOUNCE_MS = 300;

export function fold(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replaceAll("ı", "i");
}

export function matchesSearch(query: string, ...fields: (string | null)[]): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const haystack = fold(fields.filter(Boolean).join(" "));
  return words.every((word) => haystack.includes(word));
}

// The query from the URL: trimmed, empty when absent.
export function parseQuery(value: string | undefined): string {
  return (value ?? "").trim().slice(0, MAX_QUERY_LENGTH);
}
