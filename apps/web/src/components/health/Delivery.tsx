// Delivery (ADR-0045): how the system itself changes, after what it does and
// costs. A deployment strip like the other 30-day rows, DORA's four other
// measures in one row with their counts, and the latest deployments, each
// linking to its pull request on GitHub.
import { pullRequestUrl } from "@/lib/links";
import type { Delivery as DeliveryData, HealthPanel, RecentDeployment } from "@/lib/panel";
import { deliveryCells, formatDayMonthTime, formatDuration } from "@/lib/panel";
import { strings } from "@/lib/strings";

import { CellLegend } from "./Cells";
import styles from "./HealthPanel.module.css";
import { HistoryRow } from "./History";

const text = strings.health.delivery;
const DASH = "–";

function duration(seconds: number | null): string {
  return seconds === null ? DASH : formatDuration(seconds);
}

// The pull request number in the accent colour, then its title.
function Title({ number, title }: { number: number; title: string }) {
  return (
    <>
      <span className={styles.pullNumber}>#{number}</span> {title}
    </>
  );
}

function Measures({ delivery }: { delivery: DeliveryData }) {
  const ratio = (count: number) => `${count} / ${delivery.deployments}`;
  // Name and value only (owner's review): the rates carry their counts.
  const measures = [
    { name: text.leadTime, value: duration(delivery.median_lead_time_seconds) },
    { name: text.changeFailure, value: ratio(delivery.change_failures) },
    { name: text.recovery, value: duration(delivery.median_recovery_seconds) },
    { name: text.rework, value: ratio(delivery.rework_deployments) },
  ];
  return (
    <dl className={styles.measures}>
      {measures.map((measure) => (
        <div key={measure.name} className={styles.measure}>
          <dt className={styles.detail}>{measure.name}</dt>
          <dd className={styles.measureValue}>{measure.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Recent({ deployments }: { deployments: RecentDeployment[] }) {
  return (
    <div className={styles.deployments}>
      <div className={`${styles.deployment} ${styles.deploymentHead}`} aria-hidden="true">
        <span>{text.released}</span>
        <span>{text.change}</span>
        <span className={styles.num}>{text.duration}</span>
      </div>
      {deployments.map((deployment) => {
        const number = deployment.pull_request_number;
        const cells = (
          <>
            <span className={styles.deploymentTime}>
              {formatDayMonthTime(new Date(deployment.deployed_at))}
            </span>
            <span className={styles.deploymentTitle}>
              {number === null ? (
                text.noPullRequest
              ) : (
                <Title number={number} title={deployment.pull_request_title ?? ""} />
              )}
            </span>
            <span className={styles.num}>{duration(deployment.lead_time_seconds)}</span>
          </>
        );
        return number === null ? (
          <div key={deployment.deployed_at} className={styles.deployment}>
            {cells}
          </div>
        ) : (
          <a
            key={deployment.deployed_at}
            className={styles.deployment}
            href={pullRequestUrl(number)}
            target="_blank"
            rel="noreferrer noopener"
          >
            {cells}
          </a>
        );
      })}
    </div>
  );
}

function Head() {
  return (
    <div className={styles.head}>
      <h2 id="delivery-title" className={styles.heading}>
        {text.title}
      </h2>
      <span className={styles.aside}>{text.aside}</span>
    </div>
  );
}

// The delivery data is read apart from the rest of the panel (ADR-0045):
// when it cannot be read, only this section says so.
export function Delivery({ panel }: { panel: HealthPanel }) {
  const delivery = panel.delivery;
  if (delivery === null) {
    return (
      <section className={styles.section} aria-labelledby="delivery-title">
        <Head />
        <p className={`${styles.card} ${styles.unavailable}`}>{text.unavailable}</p>
      </section>
    );
  }
  const last = delivery.last_deployed_at;
  return (
    <section className={styles.section} aria-labelledby="delivery-title">
      <Head />
      <div className={styles.card}>
        <HistoryRow
          name={text.deployments}
          score={<span className={styles.scoreValue}>{delivery.deployments}</span>}
          caption={text.failedAttempts(delivery.failed_attempts)}
          cells={deliveryCells(panel.delivery_days, new Date(panel.read_at))}
          detail={last ? text.lastDeploy(formatDayMonthTime(new Date(last))) : DASH}
          words={text.cells}
        />
        <Measures delivery={delivery} />
        <Recent deployments={panel.recent_deployments} />
      </div>
      <CellLegend words={text.cells} />
    </section>
  );
}
