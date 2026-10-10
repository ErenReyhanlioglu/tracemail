// Theme choice (ADR-0034): absent means "follow the system"; a stored
// choice overrides it. Kept in a cookie so the server renders the right
// theme on the first paint.

export type Theme = "light" | "dark";

export const THEME_COOKIE = "tracemail_theme";
export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isTheme(value: string | undefined): value is Theme {
  return value === "light" || value === "dark";
}
