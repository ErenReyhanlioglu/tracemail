// A page with one narrow centered column and no navigation: login, not
// found, and unexpected errors (ADR-0039; v2 look, ADR-0052). The logo
// leads, linked home, its dot telling the page's state; a decorative strip
// of cells may follow, as the health panel draws them; then the title, a
// short body, an optional mono code line, and the actions, side by side.
// An optional notice says what just went wrong (in text, not by color
// alone). Actions are links or buttons styled with actionClass.
import Link from "next/link";
import type { ReactNode } from "react";

import { strings } from "@/lib/strings";

import styles from "./CenteredPage.module.css";
import { type LogoDot, LogoMark } from "./icons/LogoMark";

export const actionClass = { primary: styles.primary, secondary: styles.secondary };

// The strip's last cell: a missing record (404) or a failure (500).
export type StripEnd = "missing" | "failed";

const STRIP_CELLS = 11;

// Decorative: the page's story told in the panel's cells, read by no one.
function Strip({ end }: { end: StripEnd }) {
  return (
    <div className={styles.strip} aria-hidden="true">
      {Array.from({ length: STRIP_CELLS }, (_, cell) => (
        <span key={cell} className={styles.cell} />
      ))}
      <span className={`${styles.cell} ${end === "missing" ? styles.missing : styles.failed}`} />
    </div>
  );
}

export function CenteredPage({
  title,
  body,
  notice,
  dot = "accent",
  strip,
  code,
  action,
  links,
  children,
}: {
  title: string;
  body?: string;
  notice?: string;
  dot?: LogoDot;
  strip?: StripEnd;
  // A mono line under the body, such as the status and the address.
  code?: ReactNode;
  action: ReactNode;
  // A second action beside the first.
  links?: ReactNode;
  // Anything below the actions, such as the login page's visitor card.
  children?: ReactNode;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.column}>
        <Link href="/" className={styles.home} aria-label={strings.appName}>
          <LogoMark className={styles.logo} dot={dot} />
        </Link>
        {strip ? <Strip end={strip} /> : null}
        <h1 className={styles.title}>{title}</h1>
        {notice ? (
          <p className={styles.notice} role="alert">
            {notice}
          </p>
        ) : null}
        {body ? <p className={styles.text}>{body}</p> : null}
        {code ? <div className={styles.code}>{code}</div> : null}
        <div className={styles.actions}>
          {action}
          {links}
        </div>
        {children}
      </div>
    </main>
  );
}
