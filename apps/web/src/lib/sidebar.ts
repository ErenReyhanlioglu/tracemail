// Sidebar width choice: expanded unless the viewer collapsed it, since
// icons alone are harder to recognize than labels (NN/g). Kept in a cookie
// so the server renders the chosen width on the first paint, like the theme.

export const SIDEBAR_COOKIE = "tracemail_sidebar";
export const SIDEBAR_COLLAPSED = "collapsed";
export const SIDEBAR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isCollapsed(value: string | undefined): boolean {
  return value === SIDEBAR_COLLAPSED;
}
