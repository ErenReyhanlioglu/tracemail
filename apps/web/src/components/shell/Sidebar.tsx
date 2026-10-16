// Navigation as in the mockups, with an icon per section (sections and
// their access: navItems.ts). Wide screens only; phones get the bottom bar
// (ADR-0047). The sidebar collapses to its icons; labels stay in the markup
// for screen readers and show as a tooltip (ADR-0041). A clicked section
// shows as current at once, before its page arrives (ADR-0049).
import { cookies } from "next/headers";
import Link from "next/link";

import type { Viewer } from "@/lib/load";
import { LOGIN_PATH } from "@/lib/paths";
import { isCollapsed, SIDEBAR_COOKIE } from "@/lib/sidebar";
import { strings } from "@/lib/strings";

import { LockIcon, SignInIcon } from "../icons/NavIcons";
import { LogoMark } from "../icons/LogoMark";
import { PendingLink, PendingNavigation } from "../navigation/Pending";
import {
  isComingLater,
  isLocked,
  NAV,
  type NavItem,
  SECTION_GROUP,
  type Section,
} from "./navItems";
import { SidebarToggle } from "./SidebarToggle";
import { SignOutButton } from "./SignOutButton";
import styles from "./Sidebar.module.css";
import { ThemeToggle } from "./ThemeToggle";

const SIDEBAR_ID = "sidebar";

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

function Item({ item, active, viewer }: { item: NavItem; active: Section; viewer: Viewer }) {
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
      {locked ? (
        <span className={styles.lock}>
          <LockIcon />
        </span>
      ) : null}
    </PendingLink>
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
        <SignOutButton className={styles.footerAction} labelClassName={styles.label} />
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
      <PendingNavigation>
        <ul className={styles.items}>
          {NAV.map((item) => (
            <li key={item.label}>
              <Item item={item} active={active} viewer={viewer} />
            </li>
          ))}
        </ul>
      </PendingNavigation>
      <Footer viewer={viewer} />
    </nav>
  );
}
