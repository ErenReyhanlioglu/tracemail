// Shown at once when the health panel is opened from the sidebar (ADR-0049),
// before the page itself streams in: the same frame, introduction, and
// incident list, and every part in its loading state (ADR-0050). The viewer
// comes from the session cookie alone, without asking the API.
import { AppShell } from "@/components/shell/AppShell";
import styles from "@/components/health/HealthPanel.module.css";
import { Incidents } from "@/components/health/Incidents";
import { PanelIntro } from "@/components/health/PanelIntro";
import {
  DeliverySkeleton,
  ResourcesSkeleton,
  RunsSkeleton,
} from "@/components/health/Skeletons";
import { hasSession } from "@/lib/api";
import { strings } from "@/lib/strings";

import listStyles from "../list.module.css";

export default async function Loading() {
  return (
    <AppShell active="health" viewer={(await hasSession()) ? "owner" : "visitor"}>
      <header className={listStyles.header}>
        <h1 className={listStyles.title}>{strings.health.title}</h1>
      </header>
      <div className={styles.panel}>
        <PanelIntro />
        <RunsSkeleton />
        <ResourcesSkeleton />
        <DeliverySkeleton />
        <Incidents />
      </div>
    </AppShell>
  );
}
