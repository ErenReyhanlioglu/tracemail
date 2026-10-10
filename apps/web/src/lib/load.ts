// Loading private data for a page: without a session the visitor is sent to
// login and receives no data; when the API is down the page shows a message.
import "server-only";

import { redirect } from "next/navigation";

import { ApiUnavailableError, NotSignedInError } from "@/lib/api";

const LOGIN_PATH = "/login";

export async function loadPrivate<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof NotSignedInError) {
      redirect(LOGIN_PATH);
    }
    if (error instanceof ApiUnavailableError) {
      return null;
    }
    throw error;
  }
}
