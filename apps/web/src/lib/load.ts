// Loading data for a page. Private data: a visitor without a session sees the
// section's locked page and receives no data; without a session cookie the
// API is not even asked. When the API is down the page shows its unavailable
// state.
import "server-only";

import { ApiUnavailableError, fetchRole, hasSession, NotSignedInError } from "@/lib/api";
import type { Loaded } from "@/lib/failures";

// Who is looking at a page: the owner, or a visitor without a session.
export type Viewer = "owner" | "visitor";

// A private page's data: locked for a visitor.
export type Private<T> = { locked: true } | ({ locked: false } & Loaded<T>);

const LOCKED = { locked: true } as const;

export async function loadPrivate<T>(load: () => Promise<T>): Promise<Private<T>> {
  if (!(await hasSession())) {
    return LOCKED;
  }
  try {
    return { locked: false, ok: true, data: await load() };
  } catch (error) {
    if (error instanceof NotSignedInError) {
      return LOCKED;
    }
    if (error instanceof ApiUnavailableError) {
      return { locked: false, ok: false, reason: error.reason };
    }
    throw error;
  }
}

// A public page's part (ADR-0050): when the API cannot answer it, only that
// part says so, and why.
export async function loadPart<T>(load: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      return { ok: false, reason: error.reason };
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
