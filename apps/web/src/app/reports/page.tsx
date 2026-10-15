// Match reports: not built yet. A visitor sees the section's locked page;
// the owner sees that it is coming. No data is read.
import type { Metadata } from "next";

import { LockedPage } from "@/components/locked/LockedPage";
import { currentViewer } from "@/lib/load";
import { strings } from "@/lib/strings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: strings.pageTitle(strings.nav.reports),
  robots: { index: false },
};

export default async function ReportsPage() {
  return (
    <LockedPage section="reports" title={strings.nav.reports} viewer={await currentViewer()} />
  );
}
