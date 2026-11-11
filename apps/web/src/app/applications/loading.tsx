// Shown while the application list loads (ADR-0039).
// A visitor (no session cookie) sees the locked page straight away, the same
// page that follows, so nothing of the owner's view ever flashes; the cookie
// is read without asking the API.
import { AppShell } from "@/components/shell/AppShell";
import { LockedPage } from "@/components/locked/LockedPage";
import { APPLICATION_TABLE } from "@/components/ApplicationTable";
import { TableSkeleton } from "@/components/TableSkeleton";
import { FILTERS } from "@/lib/applications";
import { hasSession } from "@/lib/api";
import { strings } from "@/lib/strings";


export default async function Loading() {
  if (!(await hasSession())) {
    return <LockedPage section="applications" title={strings.applications.title} viewer="visitor" />;
  }
  return (
    <AppShell active="applications" viewer="owner">
      <h1 className="visually-hidden">{strings.applications.title}</h1>
      <TableSkeleton
        shape={APPLICATION_TABLE}
        segments={FILTERS.length}
        menu={false}
      />
    </AppShell>
  );
}
