// What the system is, above the measurements (ADR-0040): one paragraph and
// links to the source and the decision records.
import { DECISIONS_URL, REPOSITORY_URL } from "@/lib/links";
import { strings } from "@/lib/strings";

import { ExternalIcon } from "../TableParts";
import styles from "./HealthPanel.module.css";

const text = strings.health;

function OutboundLink({ href, label }: { href: string; label: string }) {
  return (
    <a className={styles.link} href={href} target="_blank" rel="noreferrer noopener">
      {label}
      <ExternalIcon />
      <span className="visually-hidden">, {text.opensInNewTab}</span>
    </a>
  );
}

export function PanelIntro() {
  return (
    <div className={styles.lead}>
      <p className={styles.intro}>{text.intro}</p>
      <nav className={styles.links} aria-label={text.linksLabel}>
        <OutboundLink href={REPOSITORY_URL} label={text.sourceCode} />
        <OutboundLink href={DECISIONS_URL} label={text.decisions} />
      </nav>
    </div>
  );
}
