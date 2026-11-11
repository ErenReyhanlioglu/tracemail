// Public links: the developer's profiles in the sidebar (ADR-0052), and on
// the health panel the repository.

export const GITHUB_PROFILE_URL = "https://github.com/ErenReyhanlioglu";
export const LINKEDIN_URL = "https://www.linkedin.com/in/eren-reyhanl%C4%B1o%C4%9Flu-664a8a254/";
export const PORTFOLIO_URL = "https://erenreyhanlioglu.github.io/";
export const REPOSITORY_URL = `${GITHUB_PROFILE_URL}/tracemail`;
// Incident reports (CLAUDE.md, Incidents); the panel links each summary.
export const INCIDENTS_URL = `${REPOSITORY_URL}/blob/main/docs/incidents`;
// A pull request on GitHub, linked from the delivery list (ADR-0045).
export function pullRequestUrl(number: number): string {
  return `${REPOSITORY_URL}/pull/${number}`;
}
