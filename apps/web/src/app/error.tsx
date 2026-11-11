"use client";

// Any unexpected error below the root layout: one page for all of them, with
// a retry (ADR-0039; v2 look, ADR-0052): the logo's dot red, the strip
// ending in a failure, and a code line to share. Details stay in the server
// log; the browser receives only Next.js's error digest, which the line
// shows as the request's code, with the time it happened.
import Link from "next/link";
import { useState } from "react";

import { actionClass, CenteredPage } from "@/components/CenteredPage";
import styles from "@/components/CenteredPage.module.css";
import { CheckIcon, CopyIcon, HealthIcon, RetryIcon } from "@/components/icons/NavIcons";
import { formatClock } from "@/lib/panel";
import { PANEL_PATH } from "@/lib/paths";
import { strings } from "@/lib/strings";

const text = strings.errorPage;

function CodeLine({ digest }: { digest: string | undefined }) {
  const [time] = useState(() => formatClock(new Date()));
  const [copied, setCopied] = useState(false);
  const plain = [`${text.protocol} ${text.code}`, digest ? `${text.request} ${digest}` : null, time]
    .filter(Boolean)
    .join(" · ");
  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(plain);
    setCopied(true);
  }
  return (
    <>
      <span>
        {text.protocol} <b className={styles.error}>{text.code}</b>
        {digest ? (
          <>
            {" · "}
            {text.request} <b>{digest}</b>
          </>
        ) : null}
        {" · "}
        {time}
      </span>
      <button
        type="button"
        className={styles.copy}
        onClick={() => void copy()}
        aria-label={copied ? text.copied : text.copy}
        title={copied ? text.copied : text.copy}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </>
  );
}

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <CenteredPage
      title={text.title}
      body={text.body}
      dot="failed"
      strip="failed"
      code={<CodeLine digest={error.digest} />}
      action={
        <button type="button" className={actionClass.primary} onClick={() => retry()}>
          <RetryIcon />
          {strings.states.retry}
        </button>
      }
      links={
        <Link className={actionClass.secondary} href={PANEL_PATH}>
          <HealthIcon />
          {strings.notFound.toPanel}
        </Link>
      }
    />
  );
}
