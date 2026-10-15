// Shown while the incoming-postings list loads (ADR-0039).
// A visitor (no session cookie) sees the locked page straight away, the same
// page that follows, so nothing of the owner's view ever flashes; the cookie
// is read without asking the API.
import { AppShell } from "@/components/AppShell";
import { LockedPage } from "@/components/locked/LockedPage";
import { POSTING_TABLE } from "@/components/PostingTable";
import { TableSkeleton } from "@/components/TableSkeleton";
import { STATUS_FILTERS } from "@/lib/postings";
import { hasSession } from "@/lib/api";
import { strings } from "@/lib/strings";

import styles from "../list.module.css";

export default async function Loading() {
  if (!(await hasSession())) {
    return <LockedPage section="postings" title={strings.postings.title} viewer="visitor" />;
  }
  return (
    <AppShell active="postings" viewer="owner">
      <header className={styles.header}>
        <h1 className={styles.title}>{strings.postings.title}</h1>
      </header>
      <TableSkeleton
        shape={POSTING_TABLE}
        segments={STATUS_FILTERS.length}
        menu={true}
      />
    </AppShell>
  );
}
