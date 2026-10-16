// The browser's own request for one public part of the health panel
// (ADR-0050), so a failed part's card retries that part alone. Public data
// only: the panel's parts carry system-level values and are open to every
// visitor; private data is never fetched from the browser.
import { type Loaded, reasonForStatus } from "@/lib/failures";

export type PanelPart = "runs" | "storage" | "delivery";

const PANEL_PATH = "/api/v1/public/health-panel";

export async function fetchPanelPart<T>(part: PanelPart): Promise<Loaded<T>> {
  let response: Response;
  try {
    response = await fetch(`${PANEL_PATH}/${part}`, { cache: "no-store" });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (!response.ok) {
    return { ok: false, reason: reasonForStatus(response.status) };
  }
  return { ok: true, data: (await response.json()) as T };
}
