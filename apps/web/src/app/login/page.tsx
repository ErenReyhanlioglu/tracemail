// Login: a single link into the API's Google Sign-In (ADR-0015). The page
// holds no authentication logic; the API sets the session, or sends the
// browser back here with a reason this page explains (ADR-0040). Only the
// owner can sign in and there is no sign-up, which the page says up front.
// Below, a visitor is pointed to the public health panel with the system's
// live state (ADR-0052); while the API cannot answer, the state is left out.
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CenteredPage } from "@/components/CenteredPage";
import styles from "@/components/CenteredPage.module.css";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { ArrowRightIcon, HealthIcon, LockIcon } from "@/components/icons/NavIcons";
import { loadSystemSummary } from "@/lib/navData";
import { formatClock } from "@/lib/panel";
import { PANEL_PATH } from "@/lib/paths";
import { strings } from "@/lib/strings";
import type { SystemState } from "@/lib/systemState";

const GOOGLE_LOGIN_URL = "/api/v1/auth/google/login";
const text = strings.login;

const STATE_CLASS: Record<SystemState, string | undefined> = {
  running: styles.stateRunning,
  late: styles.stateLate,
  failed: styles.stateFailed,
  noRun: styles.stateLate,
};

export const metadata: Metadata = { title: strings.pageTitle(strings.account.signIn) };

async function VisitorStatus() {
  const summary = await loadSystemSummary();
  if (!summary) {
    return null;
  }
  return (
    <span className={`${styles.visitorStatus} ${STATE_CLASS[summary.state] ?? ""}`}>
      <span className={styles.stateWord}>{strings.health.status[summary.state]}</span>
      {summary.lastRun ? <span>· {text.lastRun(formatClock(summary.lastRun))}</span> : null}
    </span>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <CenteredPage
      title={text.title}
      body={text.lead}
      notice={error ? text.errors[error] : undefined}
      action={<GoogleSignInButton href={GOOGLE_LOGIN_URL} label={text.google} />}
    >
      <p className={styles.footnote}>
        <LockIcon />
        {text.footnote}
      </p>
      <p className={styles.divider}>{text.visitor}</p>
      <Link href={PANEL_PATH} className={styles.visitorCard}>
        <span className={styles.visitorHead}>
          <HealthIcon />
          <span>{text.toPanel}</span>
          <ArrowRightIcon />
        </span>
        <Suspense fallback={null}>
          <VisitorStatus />
        </Suspense>
      </Link>
    </CenteredPage>
  );
}
