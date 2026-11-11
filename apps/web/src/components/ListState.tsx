// What a list shows instead of its table (ADR-0039): empty, either because
// nothing has arrived yet or because the filter matches nothing (with a way
// out), or unavailable because the API failed (with a retry, ADR-0050).
import type { ReactNode } from "react";

import type { FailureReason } from "@/lib/failures";

import { SearchIcon } from "./icons/NavIcons";
import styles from "./ListState.module.css";
import { PendingLink } from "./navigation/Pending";
import { PageFailure } from "./PageFailure";

function StatePanel({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <section className={styles.state}>
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
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
      icon={<SearchIcon />}
      action={
        <PendingLink className={styles.action} href={clearHref} group="clear">
          {clearLabel}
        </PendingLink>
      }
    />
  );
}

// The API gave no list (ADR-0050): what failed, and a retry.
export function UnavailableState({ reason }: { reason: FailureReason }) {
  return <PageFailure reason={reason} />;
}
