// What the system is, above the measurements (ADR-0040): one paragraph and
// a link to the source. On wide screens the link is a button at the
// header's right, as in the v2 mockup (ADR-0052).
import { REPOSITORY_URL } from "@/lib/links";
import { strings } from "@/lib/strings";

import { GitHubIcon } from "../icons/NavIcons";
import { ExternalIcon } from "../TableParts";
import styles from "./HealthPanel.module.css";

const text = strings.health;

function OutboundLink({ href, label }: { href: string; label: string }) {
  return (
    <a className={styles.link} href={href} target="_blank" rel="noreferrer noopener">
      <span className={styles.linkMark}>
        <GitHubIcon />
      </span>
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
      </nav>
    </div>
  );
}
