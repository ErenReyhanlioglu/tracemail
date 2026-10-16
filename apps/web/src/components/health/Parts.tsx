// The health panel's parts (ADR-0050). Each awaits its own data, so the page
// shell, the introduction, and the incident list show at once and each part
// appears when its query answers. A part the API cannot answer shows what
// failed in place of its sections, with a retry of that part alone; the
// rest of the panel stays.
import type { Loaded } from "@/lib/failures";
import { formatDayMonthTime } from "@/lib/panel";
import type { DeliveryPanel, Resource, RunsPanel, StoragePanel } from "@/lib/panel";
import type { PanelPart } from "@/lib/panelParts";
import { strings } from "@/lib/strings";

import { Delivery } from "./Delivery";
import styles from "./HealthPanel.module.css";
import { DeliveryRetry, ResourcesRetry, RunsRetry } from "./RetryableParts";
import { Resources } from "./Resources";
import { RunsSections } from "./RunsSections";

export async function RunsPart({
  runs,
  version,
}: {
  runs: Promise<Loaded<RunsPanel>>;
  version: string | null;
}) {
  const part = await runs;
  if (!part.ok) {
    return <RunsRetry reason={part.reason} version={version} />;
  }
  return <RunsSections panel={part.data} now={new Date()} version={version} />;
}

// The allowances: run records give most rows, storage metadata the rest.
export async function ResourcesPart({
  runs,
  storage,
}: {
  runs: Promise<Loaded<RunsPanel>>;
  storage: Promise<Loaded<StoragePanel>>;
}) {
  const sources: [PanelPart, Loaded<{ resources: Resource[] }>][] = [
    ["runs", await runs],
    ["storage", await storage],
  ];
  const rows = sources.flatMap(([, part]) => (part.ok ? part.data.resources : []));
  const missing = sources.filter(([, part]) => !part.ok).map(([name]) => name);
  const reason = sources.flatMap(([, part]) => (part.ok ? [] : [part.reason]))[0];
  if (reason === undefined) {
    return <Resources resources={rows} notice={null} />;
  }
  return <ResourcesRetry reason={reason} rows={rows} missing={missing} />;
}

export async function DeliveryPart({ delivery }: { delivery: Promise<Loaded<DeliveryPanel>> }) {
  const part = await delivery;
  if (!part.ok) {
    return <DeliveryRetry reason={part.reason} />;
  }
  return <Delivery panel={part.data} />;
}

// When the run records were read; nothing while they cannot be.
export async function ReadAt({ runs }: { runs: Promise<Loaded<RunsPanel>> }) {
  const part = await runs;
  if (!part.ok) {
    return null;
  }
  const readAt = formatDayMonthTime(new Date(part.data.read_at));
  return <p className={styles.footer}>{strings.health.footer(readAt)}</p>;
}
