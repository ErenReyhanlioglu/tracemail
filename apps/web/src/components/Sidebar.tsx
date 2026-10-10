// Navigation as in the mockups. The application and incoming-posting lists
// exist since step 1.10; the other sections are shown but not yet reachable.
import Link from "next/link";

import { strings } from "@/lib/strings";

import { SignOutButton } from "./SignOutButton";
import styles from "./Sidebar.module.css";
import { ThemeToggle } from "./ThemeToggle";

export type Section = "postings" | "applications";

interface NavItem {
  label: string;
  section?: Section;
  href?: string;
}

const NAV: readonly NavItem[] = [
  { label: strings.nav.overview },
  { label: strings.nav.postings, section: "postings", href: "/postings" },
  { label: strings.nav.applications, section: "applications", href: "/applications" },
  { label: strings.nav.reports },
  { label: strings.nav.health },
];

export function Sidebar({ active }: { active: Section }) {
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
              <Link
                href={item.href}
                className={item.section === active ? styles.itemActive : styles.item}
                aria-current={item.section === active ? "page" : undefined}
              >
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
