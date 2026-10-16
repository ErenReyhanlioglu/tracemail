// Shown at once when match reports are opened (ADR-0049): the page itself
// asks the API who is looking, so this shows the same locked page, with the
// viewer taken from the session cookie alone.
import { LockedPage } from "@/components/locked/LockedPage";
import { hasSession } from "@/lib/api";
import { strings } from "@/lib/strings";

export default async function Loading() {
  return (
    <LockedPage
      section="reports"
      title={strings.nav.reports}
      viewer={(await hasSession()) ? "owner" : "visitor"}
    />
  );
}
