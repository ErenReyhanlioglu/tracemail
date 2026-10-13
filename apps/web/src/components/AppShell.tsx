// The app's layout: sidebar and a content column, for the owner and for
// visitors of the public pages.
import type { ReactNode } from "react";

import type { Viewer } from "@/lib/load";

import styles from "./AppShell.module.css";
import { type Section, Sidebar } from "./Sidebar";

export function AppShell({
  active,
  viewer,
  children,
}: {
  active: Section;
  viewer: Viewer;
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <Sidebar active={active} viewer={viewer} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
