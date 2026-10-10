// Navigation as in the mockups. Only the application list exists in step
// 1.10; the other sections are shown but not yet reachable.
import Link from "next/link";

import { strings } from "@/lib/strings";

import { SignOutButton } from "./SignOutButton";
import styles from "./Sidebar.module.css";
import { ThemeToggle } from "./ThemeToggle";

interface NavItem {
  label: string;
  href?: string;
}

const NAV: readonly NavItem[] = [
  { label: strings.nav.overview },
  { label: strings.nav.postings },
  { label: strings.nav.applications, href: "/applications" },
  { label: strings.nav.reports },
  { label: strings.nav.health },
];

export function Sidebar() {
  return (
    <nav className={styles.sidebar} aria-label={strings.appName}>
      <div className={styles.brand}>
        <span className={styles.brandName}>{strings.appName}</span>
        <span className={styles.brandTagline}>{strings.appTagline}</span>
      </div>
      <ul className={styles.items}>
        {NAV.map((item) => (
          <li key={item.label}>
            {item.href ? (
              <Link href={item.href} className={styles.itemActive} aria-current="page">
                {item.label}
              </Link>
            ) : (
              <span className={styles.itemDisabled} aria-disabled="true">
                {item.label}
                <span className={styles.later}>{strings.nav.comingLater}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className={styles.footer}>
        <div className={styles.footerRow}>
          <span className={styles.role}>{strings.account.owner}</span>
          <ThemeToggle />
        </div>
        <SignOutButton />
      </div>
    </nav>
  );
}
