// The sidebar's foot (ADR-0052): who is looking and the theme switch on one
// row, then a full-width button to sign out, or for a visitor to sign in.
import Link from "next/link";

import type { Viewer } from "@/lib/load";
import { LOGIN_PATH } from "@/lib/paths";
import { strings } from "@/lib/strings";

import { EyeIcon, SignInIcon } from "../icons/NavIcons";
import { SignOutButton } from "./SignOutButton";
import styles from "./Sidebar.module.css";
import { ThemeIconButton, ThemeToggle } from "./ThemeToggle";

const text = strings.account;

export function Identity({ viewer }: { viewer: Viewer }) {
  const owner = viewer === "owner";
  return (
    <span className={styles.identity}>
      <span
        className={owner ? styles.avatar : `${styles.avatar} ${styles.avatarVisitor}`}
        aria-hidden="true"
      >
        {owner ? text.ownerInitials : <EyeIcon />}
      </span>
      <span className={styles.who}>
        <span className={styles.name}>{owner ? text.ownerName : text.visitorName}</span>
        <span className={styles.role}>{owner ? text.owner : text.visitor}</span>
      </span>
    </span>
  );
}

export function SidebarFooter({ viewer }: { viewer: Viewer }) {
  return (
    <div className={styles.footer}>
      <div className={styles.footerRow}>
        <Identity viewer={viewer} />
        {/* The switch when expanded; collapsed, the phone's sun and moon
            button, which fits the icon column (one of the two shows). */}
        <span className={styles.themeSwitch}>
          <ThemeToggle />
        </span>
        <ThemeIconButton className={styles.themeIcon} />
      </div>
      <AccountButton viewer={viewer} />
    </div>
  );
}

// Sign out for the owner, sign in for a visitor; also the phone menu's last
// row (ADR-0052).
export function AccountButton({ viewer }: { viewer: Viewer }) {
  return viewer === "owner" ? (
    <SignOutButton className={styles.footerButton} labelClassName={styles.label} />
  ) : (
    <Link href={LOGIN_PATH} className={styles.signInButton} title={text.signIn}>
      <SignInIcon />
      <span className={styles.label}>{text.signIn}</span>
    </Link>
  );
}
