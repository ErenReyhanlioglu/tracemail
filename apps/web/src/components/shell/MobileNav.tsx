// Navigation on phones (ADR-0047), in place of the sidebar: a top bar with
// the logo, the theme switch, and sign-in or sign-out, and a bar fixed to
// the bottom with the five sections, each an icon over a visible label
// (NN/g). The bottom bar only navigates; actions stay in the top bar
// (Apple HIG). Hidden on wide screens by CSS, so the server renders one
// markup for every width. A tapped section shows as current at once
// (ADR-0049).
import Link from "next/link";

import type { Viewer } from "@/lib/load";
import { LOGIN_PATH } from "@/lib/paths";
import { strings } from "@/lib/strings";

import { LockIcon, SignInIcon } from "../icons/NavIcons";
import { LogoMark } from "../icons/LogoMark";
import { PendingLink, PendingNavigation } from "../navigation/Pending";
import styles from "./MobileNav.module.css";
import {
  isComingLater,
  isLocked,
  NAV,
  type NavItem,
  SECTION_GROUP,
  type Section,
} from "./navItems";
import { SignOutButton } from "./SignOutButton";
import { ThemeIconButton } from "./ThemeToggle";

export function MobileHeader({ viewer }: { viewer: Viewer }) {
  return (
    <header className={styles.header}>
      <span className={styles.brand}>
        <LogoMark className={styles.logo} />
        <span className={styles.brandName}>{strings.appName}</span>
      </span>
      <div className={styles.actions}>
        <ThemeIconButton className={styles.action} />
        {viewer === "owner" ? (
          <SignOutButton className={styles.action} labelClassName="visually-hidden" />
        ) : (
          <Link href={LOGIN_PATH} className={styles.action} title={strings.account.signIn}>
            <SignInIcon />
            <span className="visually-hidden">{strings.account.signIn}</span>
          </Link>
        )}
      </div>
    </header>
  );
}

function BarItem({ item, active, viewer }: { item: NavItem; active: Section; viewer: Viewer }) {
  const locked = isLocked(item, viewer);
  const content = (
    <>
      <span className={styles.indicator}>
        <item.icon />
        {locked ? (
          <span className={styles.lock}>
            <LockIcon />
          </span>
        ) : null}
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
