// Navigation on phones (ADR-0047), in place of the sidebar: a top bar with
// the logo and a menu button whose sheet holds the rest of the sidebar
// (ADR-0052), and a bar fixed to the bottom with the five sections, each an icon over a visible label
// (NN/g). The bottom bar only navigates; actions stay in the top bar
// (Apple HIG). Hidden on wide screens by CSS, so the server renders one
// markup for every width. A tapped section shows as current at once
// (ADR-0049).
import { Suspense } from "react";

import type { Viewer } from "@/lib/load";
import { loadNavCounts, loadSystemState } from "@/lib/navData";
import { strings } from "@/lib/strings";
import type { SystemState } from "@/lib/systemState";

import { LockIcon } from "../icons/NavIcons";
import { LogoMark } from "../icons/LogoMark";
import { PendingLink, PendingNavigation } from "../navigation/Pending";
import styles from "./MobileNav.module.css";
import {
  type CountKey,
  isComingLater,
  isLocked,
  NAV,
  type NavItem,
  SECTION_GROUP,
  type Section,
} from "./navItems";
import { MenuSheet } from "./MenuSheet";
import { MobileMenu } from "./MobileMenu";

export function MobileHeader({ viewer }: { viewer: Viewer }) {
  return (
    <header className={styles.header}>
      <span className={styles.brand}>
        <LogoMark className={styles.logo} />
        <span className={styles.brandName}>{strings.appName}</span>
      </span>
      <div className={styles.actions}>
        <MobileMenu buttonClassName={styles.action}>
          <MenuSheet viewer={viewer} />
        </MobileMenu>
      </div>
    </header>
  );
}

const HEALTH_CLASS: Record<SystemState, string | undefined> = {
  running: styles.healthOk,
  late: styles.healthLate,
  failed: styles.healthFailed,
  noRun: styles.healthLate,
};

// The sidebar's counts as notification badges on the bar's icons (ADR-0052):
// the owner's only, and they arrive on their own.
async function CountBadge({ count }: { count: CountKey }) {
  const counts = await loadNavCounts();
  const value = counts?.[count] ?? 0;
  if (value === 0) {
    return null;
  }
  return (
    <>
      <span className={styles.badge} aria-hidden="true">
        {value}
      </span>
      <span className="visually-hidden">, {value}</span>
    </>
  );
}

// The system's state as the sidebar's haloed dot, for everyone.
async function HealthBadge() {
  const state = await loadSystemState();
  if (state === null) {
    return null;
  }
  return (
    <>
      <span className={`${styles.healthDot} ${HEALTH_CLASS[state] ?? ""}`} aria-hidden="true" />
      <span className="visually-hidden">, {strings.health.status[state]}</span>
    </>
  );
}

function Corner({ item, locked }: { item: NavItem; locked: boolean }) {
  if (locked) {
    return (
      <span className={styles.lock}>
        <LockIcon />
      </span>
    );
  }
  if (item.section === "health") {
    return (
      <Suspense fallback={null}>
        <HealthBadge />
      </Suspense>
    );
  }
  return item.count ? (
    <Suspense fallback={null}>
      <CountBadge count={item.count} />
    </Suspense>
  ) : null;
}

function BarItem({ item, active, viewer }: { item: NavItem; active: Section; viewer: Viewer }) {
  const locked = isLocked(item, viewer);
  const content = (
    <>
      <span className={styles.indicator}>
        <item.icon />
        <Corner item={item} locked={locked} />
      </span>
      {/* Screen readers get the full name, as in the sidebar. */}
      <span className={styles.label} aria-hidden="true">
        {item.shortLabel}
      </span>
      <span className="visually-hidden">
        {item.label}
        {locked ? `, ${strings.nav.ownerOnly}` : ""}
        {isComingLater(item, viewer) ? `, ${strings.nav.comingLater}` : ""}
      </span>
    </>
  );
  if (isComingLater(item, viewer)) {
    return (
      <span className={styles.itemDisabled} aria-disabled="true">
        {content}
      </span>
    );
  }
  return (
    <PendingLink
      href={item.href}
      group={SECTION_GROUP}
      className={styles.item}
      selectedClassName={styles.itemActive}
      selected={item.section === active}
      current="page"
    >
      {content}
    </PendingLink>
  );
}

export function BottomNav({ active, viewer }: { active: Section; viewer: Viewer }) {
  return (
    <nav className={styles.bar} aria-label={strings.appName}>
      <PendingNavigation>
        <ul className={styles.items}>
          {NAV.map((item) => (
            <li key={item.section}>
              <BarItem item={item} active={active} viewer={viewer} />
            </li>
          ))}
        </ul>
      </PendingNavigation>
    </nav>
  );
}
