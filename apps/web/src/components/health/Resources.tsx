// Free-tier allowances against their limits (ADR-0017, ADR-0044): what is
// used, the month-end projection where history allows one, and the 85%
// line past which an optimization is mandatory. Bars are quantities, so
// they stay neutral.
import type { ReactNode } from "react";

import type { Resource } from "@/lib/panel";
import { formatBytes, formatCount, formatPercent, isBytes } from "@/lib/panel";
import { strings } from "@/lib/strings";

import styles from "./HealthPanel.module.css";

const text = strings.health.resources;
const FULL = 100;

function width(value: number, limit: number): string {
  return `${Math.min(FULL, (value / limit) * FULL)}%`;
}

function Amounts({ resource }: { resource: Resource }) {
  const format = isBytes(resource.allowance) ? formatBytes : formatCount;
  const limit = format(resource.monthly_free);
  if (resource.projected_month === null) {
    return (
      <span className={styles.resourceText}>
        {text.now}{" "}
        <b>
          {format(resource.used_to_date)} / {limit}
        </b>{" "}
        <span className={styles.resourceShare}>
          ({formatPercent(resource.used_to_date / resource.monthly_free)})
        </span>
      </span>
    );
  }
  return (
    <span className={styles.resourceText}>
      <b>{format(resource.used_to_date)}</b> · {text.monthEnd}{" "}
      <b>
        {format(resource.projected_month)} / {limit}
      </b>{" "}
      <span className={styles.resourceShare}>
        ({formatPercent(resource.projected_month / resource.monthly_free)})
      </span>
    </span>
  );
}

// The share shown: of the month-end projection when there is one.
function share(resource: Resource): string {
  return formatPercent((resource.projected_month ?? resource.used_to_date) / resource.monthly_free);
}

function Row({ resource }: { resource: Resource }) {
  const limit = resource.monthly_free;
  return (
    <div className={styles.resource}>
      <span className={styles.resourceName}>
        {text.rows[resource.allowance] ?? resource.allowance}
      </span>
      {/* Phones: the share beside the name (ADR-0047). */}
      <span className={styles.resourcePercent} aria-hidden="true">
        {share(resource)}
      </span>
      <span className={styles.bar} aria-hidden="true">
        {resource.projected_month !== null ? (
          <span
            className={styles.projected}
            style={{ width: width(resource.projected_month, limit) }}
          />
        ) : null}
        <span className={styles.used} style={{ width: width(resource.used_to_date, limit) }} />
        <span className={styles.limit} />
      </span>
      <Amounts resource={resource} />
    </div>
  );
}

const ORDER = Object.keys(text.rows);

// The allowances come from two parts of the panel, run records and storage
// metadata (ADR-0050); a part that cannot be read leaves a notice under the
// rows it could give, or in their place when there are none.
export function Resources({
  resources,
  notice,
}: {
  resources: Resource[];
  notice: ReactNode;
}) {
  const rows = [...resources].sort(
    (a, b) => ORDER.indexOf(a.allowance) - ORDER.indexOf(b.allowance),
  );
  return (
    <section className={styles.section} aria-labelledby="resources-title">
      <div className={styles.head}>
        <h2 id="resources-title" className={styles.heading}>
          {text.title}
        </h2>
      </div>
      {rows.length > 0 ? (
        <div className={`${styles.card} ${styles.resources}`}>
          {rows.map((resource) => (
            <Row key={resource.allowance} resource={resource} />
          ))}
        </div>
      ) : null}
      {notice}
      {rows.length > 0 ? (
        <ul className={styles.legend}>
          <li>
            <span className={`${styles.swatch} ${styles.swatchUsed}`} aria-hidden="true" />
            {text.used}
          </li>
          <li>
            <span className={`${styles.swatch} ${styles.swatchProjected}`} aria-hidden="true" />
            {text.projected}
          </li>
          <li>
            <span className={`${styles.swatch} ${styles.swatchLimit}`} aria-hidden="true" />
            {text.limit}
          </li>
        </ul>
      ) : null}
    </section>
  );
}
