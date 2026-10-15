// The last 30 days as status-page component rows (ADR-0044): name and a
// one-line description, the result at the right, a full-width strip with
// one cell per local day (the day's worst hour or build), and the window
// under it.
import type { ReactNode } from "react";

import type { CellState, HealthPanel } from "@/lib/panel";
import { dayCells, formatPercent } from "@/lib/panel";
import { strings } from "@/lib/strings";

import { CellLegend, type CellWords, Strip, summary } from "./Cells";
import styles from "./HealthPanel.module.css";

const text = strings.health.history;

export function HistoryRow({
  name,
  detail,
  score,
  caption,
  cells,
  window,
  words,
}: {
  name: string;
  detail?: string;
  score: ReactNode;
  caption: string;
  cells: CellState[];
  window?: string;
  words?: CellWords;
}) {
  return (
    <div className={styles.history}>
      <div className={styles.historyHead}>
        <div>
          <span className={styles.name}>{name}</span>
          {detail ? <span className={styles.detail}>{detail}</span> : null}
        </div>
        <div className={styles.score}>
          {score}
          <span className={styles.sub}>{caption}</span>
        </div>
      </div>
      <Strip cells={cells} label={summary(`${name}, ${text.title}`, cells, words)} tall />
      <div className={styles.window}>
        <span>{text.from}</span>
        <span className={styles.rule} />
        {window ? (
          <>
            <span className={styles.windowSummary}>{window}</span>
            <span className={styles.rule} />
          </>
        ) : null}
        <span>{text.today}</span>
      </div>
    </div>
  );
}

function Freshness({ panel, today }: { panel: HealthPanel; today: Date }) {
  const hours = panel.freshness_days.reduce((sum, day) => sum + day.hours, 0);
  const onTime = panel.freshness_days.reduce((sum, day) => sum + day.on_time, 0);
  const share = hours > 0 ? onTime / hours : null;
  const objective = panel.freshness_objective_percent / 100;
  const under = share !== null && share < objective;
  return (
    <HistoryRow
      name={text.freshnessName}
      score={
        <span className={`${styles.scoreValue} ${under ? styles.under : ""}`}>
          {share === null ? "–" : formatPercent(share)}
        </span>
      }
      detail={text.freshnessDetail(panel.freshness_target_hours)}
      caption={text.objective(formatPercent(objective))}
      cells={dayCells(panel.freshness_days, today)}
      window={text.onTime(onTime, hours)}
    />
  );
}

function Builds({ panel, today }: { panel: HealthPanel; today: Date }) {
  const builds = panel.dbt_days.reduce((sum, day) => sum + day.builds, 0);
  const ok = panel.dbt_days.reduce((sum, day) => sum + day.builds_ok, 0);
  const last = panel.last_build;
  const models = last?.project_models ?? 0;
  return (
    <HistoryRow
      name={text.dbtName}
      score={<span className={styles.scoreValue}>{`${ok} / ${builds}`}</span>}
      caption={text.buildsOk}
      cells={dayCells(panel.dbt_days, today)}
      window={
        last
          ? text.lastBuild(last.tests_passed, last.tests ?? 0, last.models_documented ?? 0, models)
          : "–"
      }
    />
  );
}

export function History({ panel }: { panel: HealthPanel }) {
  const today = new Date(panel.read_at);
  return (
    <section className={styles.section} aria-labelledby="history-title">
      <div className={styles.head}>
        <h2 id="history-title" className={styles.heading}>
          {text.title}
        </h2>
      </div>
      <div className={styles.card}>
        <Freshness panel={panel} today={today} />
        <Builds panel={panel} today={today} />
      </div>
      <CellLegend />
    </section>
  );
}
