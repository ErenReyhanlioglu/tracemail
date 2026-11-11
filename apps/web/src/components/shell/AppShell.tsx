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
  // A visitor's section fades in (ADR-0049, note of 2026-11-11); the owner's
  // stays instant. Every page renders this same shell, so the section as key
  // makes a section change mount a new content area, which plays the fade.
  const mainClass = viewer === "visitor" ? `${styles.main} ${styles.fadeIn}` : styles.main;
  return (
    <div className={styles.shell}>
      <MobileHeader viewer={viewer} />
      <Sidebar active={active} viewer={viewer} />
      <main key={active} className={mainClass}>
        {children}
      </main>
      <BottomNav active={active} viewer={viewer} />
    </div>
  );
}
