// Loading data for a page. Private data: a visitor without a session sees the
// section's locked page and receives no data; without a session cookie the
// API is not even asked. When the API is down the page shows its unavailable
// state.
import "server-only";

import { ApiUnavailableError, fetchRole, hasSession, NotSignedInError } from "@/lib/api";

// Who is looking at a page: the owner, or a visitor without a session.
export type Viewer = "owner" | "visitor";

// A private page's data: locked for a visitor, null when the API failed.
export type Private<T> = { locked: true } | { locked: false; data: T | null };

const LOCKED = { locked: true } as const;

export async function loadPrivate<T>(load: () => Promise<T>): Promise<Private<T>> {
  if (!(await hasSession())) {
    return LOCKED;
  }
  try {
    return { locked: false, data: await load() };
  } catch (error) {
    if (error instanceof NotSignedInError) {
      return LOCKED;
    }
    if (error instanceof ApiUnavailableError) {
      return { locked: false, data: null };
    }
    throw error;
  }
}

// A public page's viewer; when the API cannot answer, it is shown as to a
// visitor, which reveals nothing.
export async function currentViewer(): Promise<Viewer> {
  if (!(await hasSession())) {
    return "visitor";
  }
  try {
    return (await fetchRole()) === "owner" ? "owner" : "visitor";
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      return "visitor";
    }
    throw error;
  }
}
