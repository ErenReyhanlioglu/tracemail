// Navigation as in the mockups, with an icon per section. Every section but
// the public health panel belongs to the owner; a visitor sees them locked
// (ADR-0040). Sections not built yet are dimmed for the owner. The sidebar collapses to its icons; labels stay in
// the markup for screen readers and show as a tooltip (ADR-0041).
import { cookies } from "next/headers";
import Link from "next/link";
import type { ComponentType } from "react";

import type { Viewer } from "@/lib/load";
import { LOGIN_PATH, PANEL_PATH } from "@/lib/paths";
import { isCollapsed, SIDEBAR_COOKIE } from "@/lib/sidebar";
import { strings } from "@/lib/strings";

import {
  ApplicationsIcon,
  HealthIcon,
  LockIcon,
  OverviewIcon,
  PostingsIcon,
  ReportsIcon,
  SignInIcon,
} from "./icons/NavIcons";
import { LogoMark } from "./icons/LogoMark";
import { SidebarToggle } from "./SidebarToggle";
import { SignOutButton } from "./SignOutButton";
import styles from "./Sidebar.module.css";
import { ThemeToggle } from "./ThemeToggle";

export type Section = "postings" | "applications" | "health";

const SIDEBAR_ID = "sidebar";

interface NavItem {
  label: string;
  icon: ComponentType;
  section?: Section;
  href?: string;
  ownerOnly?: boolean;
}

const NAV: readonly NavItem[] = [
  { label: strings.nav.overview, icon: OverviewIcon, ownerOnly: true },
  {
    label: strings.nav.postings,
    icon: PostingsIcon,
    section: "postings",
    href: "/postings",
    ownerOnly: true,
  },
  {
    label: strings.nav.applications,
    icon: ApplicationsIcon,
    section: "applications",
    href: "/applications",
    ownerOnly: true,
  },
  { label: strings.nav.reports, icon: ReportsIcon, ownerOnly: true },
  { label: strings.nav.health, icon: HealthIcon, section: "health", href: PANEL_PATH },
];

function Unavailable({ item, locked }: { item: NavItem; locked: boolean }) {
  const reason = locked ? strings.nav.ownerOnly : strings.nav.comingLater;
  return (
    <span className={styles.itemDisabled} aria-disabled="true" title={item.label}>
      <item.icon />
      <span className={styles.label}>
        {item.label}
        <span className="visually-hidden">, {reason}</span>
      </span>
      {locked ? (
        <span className={styles.lock}>
          <LockIcon />
        </span>
      ) : null}
    </span>
  );
}

function Item({ item, active, viewer }: { item: NavItem; active: Section; viewer: Viewer }) {
  const locked = Boolean(item.ownerOnly) && viewer !== "owner";
  if (item.href === undefined || locked) {
    return <Unavailable item={item} locked={locked} />;
  }
  const current = item.section === active;
  return (
    <Link
      href={item.href}
      className={current ? styles.itemActive : styles.item}
      aria-current={current ? "page" : undefined}
      title={item.label}
    >
      <item.icon />
      <span className={styles.label}>{item.label}</span>
    </Link>
  );
}

function Footer({ viewer }: { viewer: Viewer }) {
  return (
    <div className={styles.footer}>
      <div className={styles.footerRow}>
        <span className={styles.role}>
          {viewer === "owner" ? strings.account.owner : strings.account.visitor}
        </span>
        <ThemeToggle />
      </div>
      {viewer === "owner" ? (
        <SignOutButton />
      ) : (
        <Link href={LOGIN_PATH} className={styles.footerAction} title={strings.account.signIn}>
          <SignInIcon />
          <span className={styles.label}>{strings.account.signIn}</span>
        </Link>
      )}
    </div>
  );
}

export async function Sidebar({ active, viewer }: { active: Section; viewer: Viewer }) {
  const collapsed = isCollapsed((await cookies()).get(SIDEBAR_COOKIE)?.value);
  return (
    <nav id={SIDEBAR_ID} className={styles.sidebar} aria-label={strings.appName}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>
          <LogoMark className={styles.logo} />
          <span className={styles.brandName}>{strings.appName}</span>
        </span>
        <SidebarToggle
          initialCollapsed={collapsed}
          controls={SIDEBAR_ID}
          className={styles.collapseButton}
        />
      </div>
      <ul className={styles.items}>
        {NAV.map((item) => (
          <li key={item.label}>
            <Item item={item} active={active} viewer={viewer} />
          </li>
        ))}
      </ul>
      <Footer viewer={viewer} />
    </nav>
  );
}
