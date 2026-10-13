// What a list shows instead of its table (ADR-0039): empty, either because
// nothing has arrived yet or because the filter matches nothing (with a way
// out), or unavailable because the API failed (with a retry).
import Link from "next/link";
import type { ReactNode } from "react";

import { strings } from "@/lib/strings";

import styles from "./ListState.module.css";
import { RetryButton } from "./RetryButton";

function StatePanel({
  title,
  body,
  action,
  inset = false,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  inset?: boolean;
}) {
  return (
    <section className={inset ? styles.inset : styles.panel}>
      <h2 className={styles.title}>{title}</h2>
      {body ? <p className={styles.body}>{body}</p> : null}
      {action}
    </section>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return <StatePanel title={title} body={body} />;
}

export function NoMatchState({
  title,
  clearLabel,
  clearHref,
}: {
  title: string;
  clearLabel: string;
  clearHref: string;
}) {
  return (
    <StatePanel
      title={title}
      inset
      action={
        <Link className={styles.action} href={clearHref}>
          {clearLabel}
        </Link>
      }
    />
  );
}

export function UnavailableState() {
  return (
    <StatePanel
      title={strings.states.unavailableTitle}
      body={strings.states.unavailableBody}
      action={<RetryButton className={styles.action} />}
    />
  );
}
