// The app's layout: sidebar and a content card, for the owner and for
// visitors of the public pages (ADR-0052). On phones the sidebar gives way
// to a top bar and a bottom bar, and the card to the plain page (ADR-0047).
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
  flush = false,
  children,
}: {
  active: Section;
  viewer: Viewer;
  // A list page: its panel fills the content card edge to edge (ADR-0052).
  flush?: boolean;
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
        className={flush ? `${styles.main} ${styles.flush}` : styles.main}
        fadeClassName={styles.fadeIn}
      >
        {children}
      </SectionMain>
      <BottomNav active={active} viewer={viewer} />
    </div>
  );
}
