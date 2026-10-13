// Shown while the incoming-postings list loads (ADR-0039).
import { AppShell } from "@/components/AppShell";
import { POSTING_TABLE } from "@/components/PostingTable";
import { TableSkeleton } from "@/components/TableSkeleton";
import { STATUS_FILTERS } from "@/lib/postings";
import { strings } from "@/lib/strings";

import styles from "../list.module.css";

export default function Loading() {
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
