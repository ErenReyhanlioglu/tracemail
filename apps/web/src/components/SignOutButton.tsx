"use client";

// Ends the session through the API, then returns to the public health panel
// (ADR-0040). Collapsed, only its icon shows; the label stays readable.
import { useRouter } from "next/navigation";

import { PANEL_PATH } from "@/lib/paths";
import { strings } from "@/lib/strings";

import { SignOutIcon } from "./icons/NavIcons";
import styles from "./Sidebar.module.css";

const LOGOUT_URL = "/api/v1/auth/logout";

export function SignOutButton() {
  const router = useRouter();

  async function signOut(): Promise<void> {
    await fetch(LOGOUT_URL, { method: "POST" });
    router.push(PANEL_PATH);
    router.refresh();
  }

  return (
    <button
      type="button"
      className={styles.footerAction}
      title={strings.account.signOut}
      onClick={() => void signOut()}
    >
      <SignOutIcon />
      <span className={styles.label}>{strings.account.signOut}</span>
    </button>
  );
}
