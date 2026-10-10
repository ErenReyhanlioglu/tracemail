// The owner's layout: sidebar and a content column.
import type { ReactNode } from "react";

import styles from "./AppShell.module.css";
import { type Section, Sidebar } from "./Sidebar";

export function AppShell({ active, children }: { active: Section; children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <Sidebar active={active} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
