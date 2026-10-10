// The owner's layout: sidebar and a content column.
import type { ReactNode } from "react";

import styles from "./AppShell.module.css";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
