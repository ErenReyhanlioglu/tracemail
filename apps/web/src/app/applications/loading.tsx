// Shown while the application list loads (ADR-0039).
import { AppShell } from "@/components/AppShell";
import { APPLICATION_TABLE } from "@/components/ApplicationTable";
import { TableSkeleton } from "@/components/TableSkeleton";
import { FILTERS } from "@/lib/applications";
import { strings } from "@/lib/strings";

import styles from "../list.module.css";

export default function Loading() {
  return (
    <AppShell active="applications" viewer="owner">
      <header className={styles.header}>
        <h1 className={styles.title}>{strings.applications.title}</h1>
      </header>
      <TableSkeleton
        shape={APPLICATION_TABLE}
        segments={FILTERS.length}
        menu={false}
      />
    </AppShell>
  );
}
