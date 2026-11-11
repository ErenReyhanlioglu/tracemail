// The sidebar's rows (ADR-0052): sections, quick views, and developer links,
// grouped under mono labels. The owner's counts and the system's dot arrive
// on their own (Suspense), so the sidebar never waits for them; a visitor's
// rows carry a lock instead of a count and ask the API for nothing private.
import { type ReactNode, Suspense } from "react";

import type { Viewer } from "@/lib/load";
import { loadNavCounts, loadSystemState } from "@/lib/navData";
import { strings } from "@/lib/strings";
import type { SystemState } from "@/lib/systemState";

import { ArrowUpRightIcon, LockIcon } from "../icons/NavIcons";
import { PendingLink } from "../navigation/Pending";
import {
  type CountKey,
  isComingLater,
  isLocked,
  type NavItem,
  SECTION_GROUP,
  type Section,
} from "./navItems";
import type { ExternalItem, ViewItem, ViewTone } from "./sidebarLinks";
import styles from "./Sidebar.module.css";

const DOT_CLASS: Record<ViewTone, string | undefined> = {
  attention: styles.dotAttention,
  waiting: styles.dotWaiting,
  accent: styles.dotAccent,
  error: styles.dotError,
};

const HEALTH_CLASS: Record<SystemState, string | undefined> = {
  running: styles.dotOk,
  late: styles.dotAttention,
  failed: styles.dotError,
  noRun: styles.dotAttention,
};

export function Group({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className={styles.group}>
      {label ? (
        <p className={styles.groupLabel} aria-hidden="true">
          {label}
        </p>
      ) : null}
      <ul className={styles.items} aria-label={label}>
        {children}
      </ul>
    </div>
  );
}

async function Count({ count }: { count: CountKey }) {
  const counts = await loadNavCounts();
  return counts ? <span className={styles.count}>{counts[count]}</span> : null;
}

async function HealthDot() {
  const state = await loadSystemState();
  if (state === null) {
    return null;
  }
  return (
    <span className={styles.trail}>
      <span className={`${styles.dot} ${HEALTH_CLASS[state]}`} />
      <span className="visually-hidden">, {strings.health.status[state]}</span>
    </span>
  );
}

// What sits at a row's end: a lock for a visitor, else the owner's count.
function Trail({ locked, count }: { locked: boolean; count?: CountKey }) {
  if (locked) {
    return (
      <span className={styles.lock}>
        <LockIcon />
      </span>
    );
  }
  return count ? (
    <Suspense fallback={null}>
      <Count count={count} />
    </Suspense>
  ) : null;
}

function ComingLater({ item }: { item: NavItem }) {
  return (
    <span className={styles.itemDisabled} aria-disabled="true" title={item.label}>
      <item.icon />
      <span className={styles.label}>
        {item.label}
        <span className="visually-hidden">, {strings.nav.comingLater}</span>
      </span>
    </span>
  );
}

export function SectionItem({
  item,
  active,
  viewer,
}: {
  item: NavItem;
  active: Section;
  viewer: Viewer;
}) {
  const locked = isLocked(item, viewer);
  if (isComingLater(item, viewer)) {
    return <ComingLater item={item} />;
  }
  return (
    <PendingLink
      href={item.href}
      group={SECTION_GROUP}
      className={styles.item}
      selectedClassName={styles.itemActive}
      selected={item.section === active}
      current="page"
      title={item.label}
    >
      <item.icon />
      <span className={styles.label}>
        {item.label}
        {locked ? <span className="visually-hidden">, {strings.nav.ownerOnly}</span> : null}
      </span>
      {item.section === "health" ? (
        <Suspense fallback={null}>
          <HealthDot />
        </Suspense>
      ) : (
        <Trail locked={locked} count={item.count} />
      )}
    </PendingLink>
  );
}

// A quick view: never shown as current; its list's section is.
export function ViewLink({ view, viewer }: { view: ViewItem; viewer: Viewer }) {
  const locked = viewer !== "owner";
  return (
    <PendingLink
      href={view.href}
      group={SECTION_GROUP}
      className={styles.item}
      selectedClassName={styles.item}
      title={view.label}
    >
      <span className={styles.dotBox} aria-hidden="true">
        <span className={`${styles.dot} ${DOT_CLASS[view.tone]}`} />
      </span>
      <span className={styles.label}>
        {view.label}
        {locked ? <span className="visually-hidden">, {strings.nav.ownerOnly}</span> : null}
      </span>
      <Trail locked={locked} count={view.count} />
    </PendingLink>
  );
}

export function ExternalLink({ link }: { link: ExternalItem }) {
  return (
    <a
      href={link.href}
      className={styles.item}
      target="_blank"
      rel="noopener noreferrer"
      title={link.label}
    >
      <link.icon />
      <span className={styles.label}>
        {link.label}
        <span className="visually-hidden">, {strings.nav.opensInNewTab}</span>
      </span>
      <span className={styles.external}>
        <ArrowUpRightIcon />
      </span>
    </a>
  );
}
