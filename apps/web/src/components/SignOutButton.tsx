"use client";

// Ends the session through the API, then returns to the login page.
import { useRouter } from "next/navigation";

import { strings } from "@/lib/strings";

import styles from "./Sidebar.module.css";

const LOGOUT_URL = "/api/v1/auth/logout";
const LOGIN_PATH = "/login";

export function SignOutButton() {
  const router = useRouter();

  async function signOut(): Promise<void> {
    await fetch(LOGOUT_URL, { method: "POST" });
    router.push(LOGIN_PATH);
    router.refresh();
  }

  return (
    <button type="button" className={styles.footerAction} onClick={() => void signOut()}>
      {strings.account.signOut}
    </button>
  );
}
