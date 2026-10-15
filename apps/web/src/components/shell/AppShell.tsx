// The app's layout: sidebar and a content column, for the owner and for
// visitors of the public pages. On phones the sidebar gives way to a top bar
// and a bottom bar (ADR-0047).
import type { ReactNode } from "react";

import type { Viewer } from "@/lib/load";

import styles from "./AppShell.module.css";
import { BottomNav, MobileHeader } from "./MobileNav";
import type { Section } from "./navItems";
import { Sidebar } from "./Sidebar";

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
      <MobileHeader viewer={viewer} />
      <Sidebar active={active} viewer={viewer} />
      <main className={styles.main}>{children}</main>
      <BottomNav active={active} viewer={viewer} />
    </div>
  );
}
