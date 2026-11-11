// A private section's page when its data cannot be shown: a visitor's locked
// view, or the owner's view of a section not built yet. The sidebar and page
// frame are the same as everywhere; only the main area changes.
import type { Viewer } from "@/lib/load";

import { AppShell } from "../shell/AppShell";
import type { Section } from "../shell/navItems";
import { type LockedKey, LockedSection } from "./LockedSection";

export function LockedPage({
  section,
  title,
  viewer,
}: {
  section: LockedKey & Section;
  title: string;
  viewer: Viewer;
}) {
  // No visible title, as on the list pages: the sidebar already marks the
  // section (owner's review, 2026-11-11). The heading stays for screen
  // readers.
  return (
    <AppShell active={section} viewer={viewer}>
      <h1 className="visually-hidden">{title}</h1>
      <LockedSection section={section} viewer={viewer} />
    </AppShell>
  );
}
