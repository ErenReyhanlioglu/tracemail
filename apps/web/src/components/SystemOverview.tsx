// The health panel's introduction to the system (ADR-0040): what it does, how
// data flows, the principles it keeps, what it runs on, and where it is
// heading. Every statement is backed by the repository's decision records;
// there are no numbers until live metrics arrive (CLAUDE.md, the public
// panel shows real data or nothing).
import { DECISIONS_URL, REPOSITORY_URL } from "@/lib/links";
import { strings } from "@/lib/strings";

import styles from "./SystemOverview.module.css";
import { StatusBadge } from "./StatusBadge";
import { ExternalIcon } from "./TableParts";

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

function Pipeline() {
  return (
    <section className={styles.section} aria-labelledby="pipeline-title">
      <h2 id="pipeline-title" className={styles.heading}>
        {text.pipelineTitle}
      </h2>
      <ol className={`${styles.grid} ${styles.pipeline}`}>
        {text.pipeline.map((step, index) => (
          <li key={step.name} className={styles.cell}>
            <span className={styles.cellNumber}>{String(index + 1).padStart(2, "0")}</span>
            <span className={styles.cellName}>{step.name}</span>
            <span className={styles.cellBody}>{step.body}</span>
          </li>
        ))}
      </ol>
      <p className={styles.note}>{text.pipelineNote}</p>
    </section>
  );
}

function Principles() {
  return (
    <section className={styles.section} aria-labelledby="principles-title">
      <h2 id="principles-title" className={styles.heading}>
        {text.principlesTitle}
      </h2>
      <ul className={styles.principles}>
        {text.principles.map((principle) => (
          <li key={principle.name}>
            <h3 className={styles.principleName}>{principle.name}</h3>
            <p className={styles.principleBody}>{principle.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stack() {
  return (
    <section className={styles.section} aria-labelledby="stack-title">
      <h2 id="stack-title" className={styles.heading}>
        {text.stackTitle}
      </h2>
      <dl className={styles.stack}>
        {text.stack.map((row) => (
          <div key={row.name} className={styles.row}>
            <dt className={styles.rowName}>{row.name}</dt>
            <dd className={styles.rowValue}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Roadmap() {
  return (
    <section className={styles.section} aria-labelledby="roadmap-title">
      <h2 id="roadmap-title" className={styles.heading}>
        {text.roadmapTitle}
      </h2>
      <ol className={`${styles.grid} ${styles.roadmap}`}>
        {text.roadmap.map((phase) => (
          <li
            key={phase.phase}
            className={styles.cell}
            aria-current={phase.current ? "step" : undefined}
          >
            <span className={styles.cellTop}>
              <span className={styles.cellNumber}>{phase.phase}</span>
              <StatusBadge
                badge={
                  phase.current
                    ? { tone: "progress", label: text.phaseCurrent }
                    : { tone: "neutral", label: text.phasePlanned }
                }
              />
            </span>
            <span className={styles.cellName}>{phase.name}</span>
            <span className={styles.cellBody}>{phase.body}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SystemOverview() {
  return (
    <div className={styles.overview}>
      <div className={styles.lead}>
        <p className={styles.intro}>{text.intro}</p>
        <nav className={styles.links} aria-label={text.linksLabel}>
          <OutboundLink href={REPOSITORY_URL} label={text.sourceCode} />
          <OutboundLink href={DECISIONS_URL} label={text.decisions} />
        </nav>
      </div>
      <aside className={styles.live} aria-labelledby="live-title">
        <h2 id="live-title" className={styles.liveTitle}>
          {text.liveTitle}
        </h2>
        <p className={styles.liveBody}>{text.liveBody}</p>
      </aside>
      <Pipeline />
      <Principles />
      <Roadmap />
      <Stack />
    </div>
  );
}
