// Loading data for a page. Private data: without a session the visitor is
// sent to the public health panel (ADR-0040) and receives no data; when the
// API is down the page shows its unavailable state.
import "server-only";

import { redirect } from "next/navigation";

import { ApiUnavailableError, fetchRole, NotSignedInError } from "@/lib/api";
import { PANEL_PATH } from "@/lib/paths";

// Who is looking at a page: the owner, or a visitor without a session.
export type Viewer = "owner" | "visitor";

export async function loadPrivate<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof NotSignedInError) {
      redirect(PANEL_PATH);
    }
    if (error instanceof ApiUnavailableError) {
      return null;
    }
    throw error;
  }
}

// A public page's viewer; when the API cannot answer, it is shown as to a
// visitor, which reveals nothing.
export async function currentViewer(): Promise<Viewer> {
  try {
    return (await fetchRole()) === "owner" ? "owner" : "visitor";
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      return "visitor";
    }
    throw error;
  }
}
