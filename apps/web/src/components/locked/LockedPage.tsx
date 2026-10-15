// A private section's page when its data cannot be shown: a visitor's locked
// view, or the owner's view of a section not built yet. The sidebar and page
// frame are the same as everywhere; only the main area changes.
import type { Viewer } from "@/lib/load";

import { AppShell } from "../AppShell";
import type { Section } from "../Sidebar";
import { type LockedKey, LockedSection } from "./LockedSection";
import listStyles from "../../app/list.module.css";

export function LockedPage({
  section,
  title,
  viewer,
}: {
  section: LockedKey & Section;
  title: string;
  viewer: Viewer;
}) {
  return (
    <AppShell active={section} viewer={viewer}>
      <header className={listStyles.header}>
        <h1 className={listStyles.title}>{title}</h1>
      </header>
      <LockedSection section={section} viewer={viewer} />
    </AppShell>
  );
}
