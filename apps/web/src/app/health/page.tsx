// The public health panel, where every visitor lands (ADR-0040): what the
// system is, then its live measurements (ADR-0044). Real data or nothing:
// when the API cannot answer, the page says so instead of showing numbers.
import type { Metadata } from "next";

import { AppShell } from "@/components/shell/AppShell";
import { Delivery } from "@/components/health/Delivery";
import { History } from "@/components/health/History";
import styles from "@/components/health/HealthPanel.module.css";
import { Incidents } from "@/components/health/Incidents";
import { PanelIntro } from "@/components/health/PanelIntro";
import { Resources } from "@/components/health/Resources";
import { StageTable } from "@/components/health/StageTable";
import { StatusLine } from "@/components/health/StatusLine";
import { UnavailableState } from "@/components/ListState";
import { ApiUnavailableError, fetchHealthPanel } from "@/lib/api";
import { currentViewer } from "@/lib/load";
import type { HealthPanel } from "@/lib/panel";
import { formatDayMonthTime } from "@/lib/panel";
import { strings } from "@/lib/strings";

import listStyles from "../list.module.css";

const text = strings.health;
const SHORT_SHA_LENGTH = 7;

export const metadata: Metadata = {
  title: strings.pageTitle(text.title),
};

async function loadPanel(): Promise<HealthPanel | null> {
  try {
    return await fetchHealthPanel();
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      return null;
    }
    throw error;
  }
}

// The commit the image was built from, baked in at build time (ADR-0002).
function version(): string | null {
  const sha = process.env.TRACEMAIL_VERSION;
  return sha ? sha.slice(0, SHORT_SHA_LENGTH) : null;
}

function Measurements({ panel }: { panel: HealthPanel }) {
  return (
    <>
      <StatusLine panel={panel} now={new Date()} version={version()} />
      <StageTable panel={panel} />
      <History panel={panel} />
      <Resources panel={panel} />
      <Delivery panel={panel} />
      <Incidents />
      <p className={styles.footer}>{text.footer(formatDayMonthTime(new Date(panel.read_at)))}</p>
    </>
  );
}

export default async function HealthPage() {
  const [viewer, panel] = await Promise.all([currentViewer(), loadPanel()]);
  return (
    <AppShell active="health" viewer={viewer}>
      <header className={listStyles.header}>
        <h1 className={listStyles.title}>{text.title}</h1>
      </header>
      <div className={styles.panel}>
        <PanelIntro />
        {panel ? <Measurements panel={panel} /> : <UnavailableState />}
      </div>
    </AppShell>
  );
}
