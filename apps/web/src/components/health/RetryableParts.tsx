"use client";

// A failed health panel part that retries alone (ADR-0050): its card counts
// down, or its button is pressed, and the browser asks the API for that part
// only; when it answers, the part's sections take the card's place. Other
// parts, failed or not, are left as they are.
import { useCallback, useState, useTransition } from "react";

import type { FailureReason, Loaded } from "@/lib/failures";
import type { DeliveryPanel, Resource, RunsPanel } from "@/lib/panel";
import { fetchPanelPart, type PanelPart } from "@/lib/panelParts";

import { FailureCard } from "../FailureCard";
import { useAutoRetry } from "../useAutoRetry";
import { Delivery, DeliveryHead } from "./Delivery";
import styles from "./HealthPanel.module.css";
import { Resources } from "./Resources";
import { RunsSections } from "./RunsSections";

function usePartRetry<T>(load: () => Promise<Loaded<T>>, reason: FailureReason) {
  const [result, setResult] = useState<Loaded<T>>({ ok: false, reason });
  const [pending, startTransition] = useTransition();
  const retry = useCallback(() => {
    startTransition(async () => {
      const next = await load();
      startTransition(() => setResult(next));
    });
  }, [load]);
  const { left, attempt } = useAutoRetry(!result.ok, pending, retry);
  return { result, left, pending, attempt };
}

const loadRuns = () => fetchPanelPart<RunsPanel>("runs");
const loadDelivery = () => fetchPanelPart<DeliveryPanel>("delivery");

export function RunsRetry({ reason, version }: { reason: FailureReason; version: string | null }) {
  const { result, left, pending, attempt } = usePartRetry(loadRuns, reason);
  if (result.ok) {
    return <RunsSections panel={result.data} now={new Date(result.data.read_at)} version={version} />;
  }
  return <FailureCard reason={result.reason} left={left} pending={pending} onRetry={attempt} />;
}

export function DeliveryRetry({ reason }: { reason: FailureReason }) {
  const { result, left, pending, attempt } = usePartRetry(loadDelivery, reason);
  if (result.ok) {
    return <Delivery panel={result.data} />;
  }
  return (
    <section className={styles.section} aria-labelledby="delivery-title">
      <DeliveryHead />
      <FailureCard reason={result.reason} left={left} pending={pending} onRetry={attempt} />
    </section>
  );
}

// The allowances, of which one or both sources failed: the rows that did
// arrive stay, and a retry asks again for the missing sources only.
export function ResourcesRetry({
  reason,
  rows,
  missing,
}: {
  reason: FailureReason;
  rows: Resource[];
  missing: PanelPart[];
}) {
  const load = useCallback(async (): Promise<Loaded<Resource[]>> => {
    const parts = await Promise.all(
      missing.map((part) => fetchPanelPart<{ resources: Resource[] }>(part)),
    );
    const failed = parts.flatMap((part) => (part.ok ? [] : [part.reason]))[0];
    if (failed) {
      return { ok: false, reason: failed };
    }
    return { ok: true, data: [...rows, ...parts.flatMap((part) => (part.ok ? part.data.resources : []))] };
  }, [missing, rows]);
  const { result, left, pending, attempt } = usePartRetry(load, reason);
  if (result.ok) {
    return <Resources resources={result.data} notice={null} />;
  }
  return (
    <Resources
      resources={rows}
      notice={<FailureCard reason={result.reason} left={left} pending={pending} onRetry={attempt} />}
    />
  );
}
