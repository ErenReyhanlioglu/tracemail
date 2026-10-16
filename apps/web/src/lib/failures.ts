// Why the API gave no data, as far as the web can tell (ADR-0050), shared by
// the server's requests and the browser's retries of a public part: no
// answer at all, BigQuery not answering behind it (503), too many requests
// (429), or anything else.
export type FailureReason = "unreachable" | "warehouse" | "busy" | "error";

// Data the API may fail to give, with the reason when it does.
export type Loaded<T> = { ok: true; data: T } | { ok: false; reason: FailureReason };

const REASON_BY_STATUS: Partial<Record<number, FailureReason>> = {
  429: "busy",
  503: "warehouse",
};

export function reasonForStatus(status: number): FailureReason {
  return REASON_BY_STATUS[status] ?? "error";
}
