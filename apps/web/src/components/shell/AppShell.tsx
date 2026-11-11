// The app's layout: sidebar and a content column, for the owner and for
// visitors of the public pages. On phones the sidebar gives way to a top bar
// and a bottom bar (ADR-0047).
import type { ReactNode } from "react";

import type { Viewer } from "@/lib/load";

import styles from "./AppShell.module.css";
import { BottomNav, MobileHeader } from "./MobileNav";
import type { Section } from "./navItems";
import { SectionMain } from "./SectionMain";
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
  // A visitor's section fades in once (ADR-0049, note of 2026-11-11); the
  // owner's stays instant. Every page renders this same shell, so the
  // section as key makes a section change mount a new content area.
  return (
    <div className={styles.shell}>
      <MobileHeader viewer={viewer} />
      <Sidebar active={active} viewer={viewer} />
      <SectionMain
        key={active}
        section={active}
        fade={viewer === "visitor"}
        className={styles.main}
        fadeClassName={styles.fadeIn}
      >
        {children}
      </SectionMain>
      <BottomNav active={active} viewer={viewer} />
    </div>
  );
}
