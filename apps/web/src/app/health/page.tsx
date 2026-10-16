// The public health panel, where every visitor lands (ADR-0040): what the
// system is, then its live measurements (ADR-0044). Real data or nothing:
// a part the API cannot answer says so instead of showing numbers. The
// three parts are requested at once and each shows when it arrives, so one
// slow or failing query holds up or takes down only its own sections
// (ADR-0050).
import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/shell/AppShell";
import styles from "@/components/health/HealthPanel.module.css";
import { Incidents } from "@/components/health/Incidents";
import { PanelIntro } from "@/components/health/PanelIntro";
import { DeliveryPart, ReadAt, ResourcesPart, RunsPart } from "@/components/health/Parts";
import {
  DeliverySkeleton,
  ResourcesSkeleton,
  RunsSkeleton,
} from "@/components/health/Skeletons";
import { fetchDeliveryPanel, fetchRunsPanel, fetchStoragePanel } from "@/lib/api";
import { currentViewer, loadPart } from "@/lib/load";
import { strings } from "@/lib/strings";

import listStyles from "../list.module.css";

const text = strings.health;
const SHORT_SHA_LENGTH = 7;

export const metadata: Metadata = {
  title: strings.pageTitle(text.title),
};

// The commit the image was built from, baked in at build time (ADR-0002).
function version(): string | null {
  const sha = process.env.TRACEMAIL_VERSION;
  return sha ? sha.slice(0, SHORT_SHA_LENGTH) : null;
}

export default async function HealthPage() {
  const runs = loadPart(fetchRunsPanel);
  const storage = loadPart(fetchStoragePanel);
  const delivery = loadPart(fetchDeliveryPanel);
  return (
    <AppShell active="health" viewer={await currentViewer()}>
      <header className={listStyles.header}>
        <h1 className={listStyles.title}>{text.title}</h1>
      </header>
      <div className={styles.panel}>
        <PanelIntro />
        <Suspense fallback={<RunsSkeleton />}>
          <RunsPart runs={runs} version={version()} />
        </Suspense>
        <Suspense fallback={<ResourcesSkeleton />}>
          <ResourcesPart runs={runs} storage={storage} />
        </Suspense>
        <Suspense fallback={<DeliverySkeleton />}>
          <DeliveryPart delivery={delivery} />
        </Suspense>
        <Incidents />
        <Suspense fallback={null}>
          <ReadAt runs={runs} />
        </Suspense>
      </div>
    </AppShell>
  );
}
