// Public links shown on the health panel: the repository and its index of
// architecture decision records.

export const REPOSITORY_URL = "https://github.com/ErenReyhanlioglu/tracemail";
export const DECISIONS_URL = `${REPOSITORY_URL}/blob/main/docs/adr/README.md`;
// Incident reports (CLAUDE.md, Incidents); the panel links each summary.
export const INCIDENTS_URL = `${REPOSITORY_URL}/blob/main/docs/incidents`;
// A pull request on GitHub, linked from the delivery list (ADR-0045).
export function pullRequestUrl(number: number): string {
  return `${REPOSITORY_URL}/pull/${number}`;
}
