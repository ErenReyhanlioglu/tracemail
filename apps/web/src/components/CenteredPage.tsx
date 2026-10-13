// A page with one narrow centered column and no navigation: login, not
// found, and unexpected errors (ADR-0039). The logo leads, linked home, and
// the title names the page; there is no card, as in GitHub's sign-in page.
// Short text only, since it is centered: an optional notice says what just
// went wrong (in text, not by color alone), the body explains before the
// primary action, a footnote qualifies it right below, and secondary links
// come last. Actions are links or buttons styled with actionClass.
import Link from "next/link";
import type { ReactNode } from "react";

import { strings } from "@/lib/strings";

import styles from "./CenteredPage.module.css";
import { LogoMark } from "./icons/LogoMark";

export const actionClass = { primary: styles.primary, secondary: styles.secondary };

export function CenteredPage({
  title,
  body,
  notice,
  footnote,
  action,
  links,
}: {
  title: string;
  body?: string;
  notice?: string;
  footnote?: string;
  action: ReactNode;
  links?: ReactNode;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.column}>
        <Link href="/" className={styles.home} aria-label={strings.appName}>
          <LogoMark className={styles.logo} />
        </Link>
        <h1 className={styles.title}>{title}</h1>
        {notice ? (
          <p className={styles.notice} role="alert">
            {notice}
          </p>
        ) : null}
        {body ? <p className={styles.text}>{body}</p> : null}
        <div className={styles.action}>{action}</div>
        {footnote ? <p className={styles.text}>{footnote}</p> : null}
        {links}
      </div>
    </main>
  );
}
