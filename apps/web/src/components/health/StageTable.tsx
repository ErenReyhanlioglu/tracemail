// One row per pipeline stage (ADR-0044): its state as a word, the last 24
// hourly cells under one shared axis, the last processing run, and the
// median duration. Serving has no history; the page answering is its check.
import type { CellState, HealthPanel, StageRow } from "@/lib/panel";
import {
  axisRunTimes,
  currentStageState,
  formatClock,
  formatDuration,
  stageCells,
} from "@/lib/panel";
import { strings } from "@/lib/strings";

import { CellLegend, Strip, summary } from "./Cells";
import styles from "./HealthPanel.module.css";

const text = strings.health.stages;
const MODELING = "dbt_build";

function detail(stage: StageRow, models: number | null): string {
  if (stage.job_name === MODELING && models !== null) {
    return text.models(models);
  }
  return text.rows[stage.job_name]?.detail ?? "";
}

// The state word follows the latest hour: skipping is running as intended.
function stateWord(cells: CellState[], lastRunStatus: string | null) {
  const state = currentStageState(cells, lastRunStatus);
  if (state === "late") {
    return { label: text.late, className: styles.wordLate };
  }
  if (state === "failed") {
    return { label: text.failed, className: styles.wordFailed };
  }
  return { label: text.running, className: styles.wordOk };
}

function Stage({ stage, models }: { stage: StageRow; models: number | null }) {
  const cells = stageCells(stage.hours);
  const word = stateWord(cells, stage.last_run_status);
  const name = text.rows[stage.job_name]?.name ?? stage.job_name;
  return (
    <div className={styles.row}>
      <div>
        <span className={styles.name}>{name}</span>
        <span className={styles.detail}>{detail(stage, models)}</span>
      </div>
      <span className={`${styles.word} ${word.className}`}>{word.label}</span>
      <div className={styles.cellsColumn}>
        <Strip cells={cells} label={summary(`${name}, ${text.window}`, cells)} />
      </div>
      <span className={styles.num}>
        {stage.last_run_at ? formatClock(new Date(stage.last_run_at)) : "–"}
        {stage.last_duration_seconds !== null ? (
          <span className={styles.sub}>{formatDuration(stage.last_duration_seconds)}</span>
        ) : null}
      </span>
      <span className={styles.num}>
        {stage.median_duration_seconds !== null
          ? formatDuration(stage.median_duration_seconds)
          : "–"}
        <span className={styles.sub}>{text.medianWindow}</span>
      </span>
    </div>
  );
}

function Serving() {
  const serving = text.serving;
  return (
    <div className={styles.row}>
      <div>
        <span className={styles.name}>{serving.name}</span>
        <span className={styles.detail}>{serving.detail}</span>
      </div>
      <span className={`${styles.word} ${styles.wordOk}`}>{serving.state}</span>
      <span className={`${styles.note} ${styles.cellsColumn}`}>{serving.note}</span>
      <span className={styles.num}>{serving.now}</span>
      <span className={styles.num}>–</span>
    </div>
  );
}

export function StageTable({ panel }: { panel: HealthPanel }) {
  const axis = axisRunTimes(new Date(panel.read_at));
  const models = panel.last_build?.project_models ?? null;
  return (
    <section className={styles.section} aria-labelledby="stages-title">
      <div className={styles.head}>
        <h2 id="stages-title" className={styles.heading}>
          {text.title}
        </h2>
        <span className={styles.aside}>{text.aside}</span>
      </div>
      <div className={styles.card}>
        <div className={`${styles.row} ${styles.headRow}`} aria-hidden="true">
          <span>{text.stage}</span>
          <span>{text.state}</span>
          <span className={styles.axis}>
            <span>{formatClock(axis.first)}</span>
            <span>{text.window}</span>
            <span>{formatClock(axis.last)}</span>
          </span>
          <span className={styles.num}>{text.lastProcessed}</span>
          <span className={styles.num}>{text.median}</span>
        </div>
        {panel.stages.map((stage) => (
          <Stage key={stage.job_name} stage={stage} models={models} />
        ))}
        <Serving />
      </div>
      <CellLegend />
    </section>
  );
}
