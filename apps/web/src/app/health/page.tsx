// The public health panel, where every visitor lands (ADR-0040). Until its
// live metrics arrive (Phase 3) it introduces the system: what it does, how
// data flows, and what it runs on, with no numbers, since the public panel
// shows real data or nothing.
import type { Metadata } from "next";

import { AppShell } from "@/components/AppShell";
import { SystemOverview } from "@/components/SystemOverview";
import { currentViewer } from "@/lib/load";
import { strings } from "@/lib/strings";

import styles from "../list.module.css";

const text = strings.health;

export const metadata: Metadata = {
  title: strings.pageTitle(text.title),
};

export default async function HealthPage() {
  return (
    <AppShell active="health" viewer={await currentViewer()}>
      <header className={styles.header}>
        <h1 className={styles.title}>{text.title}</h1>
      </header>
      <SystemOverview />
    </AppShell>
  );
}
