// Overview: not built yet. A visitor sees the section's locked page;
// the owner sees that it is coming. No data is read.
import type { Metadata } from "next";

import { LockedPage } from "@/components/locked/LockedPage";
import { currentViewer } from "@/lib/load";
import { strings } from "@/lib/strings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: strings.pageTitle(strings.nav.overview),
  robots: { index: false },
};

export default async function OverviewPage() {
  return (
    <LockedPage section="overview" title={strings.nav.overview} viewer={await currentViewer()} />
  );
}
