// The public health panel's data (ADR-0044): the API's response types and
// the pure helpers that turn them into cells, numbers, and times. Times are
// shown in the owner's time zone; numbers in Turkish formatting.

export type StageState = "ok" | "late" | "failed" | "skipped" | "missed" | "pending";
export type DayState = "ok" | "late" | "failed";
// What a cell shows; "none" pads the strips where no history exists yet.
export type CellState = "ok" | "skipped" | "late" | "failed" | "none";

export interface LastRun {
  started_at: string;
  duration_seconds: number;
  run_status: string;
}

export interface StageRow {
  job_name: string;
  last_run_at: string | null;
  last_run_status: string | null;
  last_duration_seconds: number | null;
  median_duration_seconds: number | null;
  hours: StageState[];
}

export interface FreshnessDay {
  local_date: string;
  state: DayState;
  hours: number;
  on_time: number;
}

export interface BuildDay {
  local_date: string;
  state: DayState;
  builds: number;
  builds_ok: number;
}

export interface LastBuild {
  started_at: string;
  run_status: string;
  tests: number | null;
  tests_passed: number;
  project_models: number | null;
  models_tested: number | null;
  models_documented: number | null;
}

export interface Resource {
  allowance: string;
  used_to_date: number;
  projected_month: number | null;
  monthly_free: number;
}

export interface Delivery {
  deployments: number;
  failed_attempts: number;
  median_lead_time_seconds: number | null;
  changes_with_lead_time: number;
  change_failures: number;
  median_recovery_seconds: number | null;
  recovered_failures: number;
  rework_deployments: number;
  last_deployed_at: string | null;
}

export interface DeliveryDay {
  local_date: string;
  state: DayState;
}

export interface RecentDeployment {
  deployed_at: string;
  pull_request_number: number | null;
  pull_request_title: string | null;
  lead_time_seconds: number | null;
  is_change_failure: boolean;
}

export interface HealthPanel {
  read_at: string;
  freshness_target_hours: number;
  freshness_objective_percent: number;
  last_ingest: LastRun | null;
  on_time_streak_hours: number;
  stages: StageRow[];
  freshness_days: FreshnessDay[];
  dbt_days: BuildDay[];
  last_build: LastBuild | null;
  resources: Resource[];
  // Null when the delivery data cannot be read; the rest still shows.
  delivery: Delivery | null;
  delivery_days: DeliveryDay[];
  recent_deployments: RecentDeployment[];
}

export const STAGE_HOURS = 24;
export const WINDOW_DAYS = 30;
// ADR-0017: an allowance projected past this share needs an optimization.
export const ACTION_SHARE = 0.85;
export const COMPLETE = "COMPLETE";

const TIME_ZONE = "Europe/Istanbul";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 60 * MINUTE_SECONDS;

// A missed hour is a failure of the system; it shows as one. A pending hour
// has no record yet and shows as such, until its deadline judges it.
const STAGE_CELL: Record<StageState, CellState> = {
  ok: "ok",
  late: "late",
  failed: "failed",
  skipped: "skipped",
  missed: "failed",
  pending: "none",
};

// Oldest first, padded at the start to `length` cells.
function padStart(cells: CellState[], length: number): CellState[] {
  const kept = cells.slice(-length);
  return [...Array<CellState>(length - kept.length).fill("none"), ...kept];
}

export function stageCells(hours: StageState[]): CellState[] {
  return padStart(
    hours.map((state) => STAGE_CELL[state]),
    STAGE_HOURS,
  );
}

const LOCAL_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });

// The local calendar date (YYYY-MM-DD) of an instant.
export function localDate(instant: Date): string {
  return LOCAL_DATE.format(instant);
}

// One cell per local day of the window ending on `today`, oldest first.
export function dayCells(days: { local_date: string; state: DayState }[], today: Date): CellState[] {
  const byDate = new Map(days.map((day) => [day.local_date, day.state]));
  return Array.from({ length: WINDOW_DAYS }, (_, index) => {
    const offset = WINDOW_DAYS - 1 - index;
    return byDate.get(localDate(new Date(today.getTime() - offset * DAY_MS))) ?? "none";
  });
}

// Delivery days: a day without deployments after the first one is a quiet
// day ("skipped"), not a gap; before the first, there is no history.
export function deliveryCells(days: { local_date: string; state: DayState }[], today: Date): CellState[] {
  const cells = dayCells(days, today);
  const first = cells.findIndex((cell) => cell !== "none");
  return cells.map((cell, index) => (first >= 0 && index > first && cell === "none" ? "skipped" : cell));
}

export function countCells(cells: CellState[]): Record<CellState, number> {
  const counts: Record<CellState, number> = { ok: 0, skipped: 0, late: 0, failed: 0, none: 0 };
  for (const cell of cells) {
    counts[cell] += 1;
  }
  return counts;
}

const CLOCK = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
const DAY_MONTH_TIME = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
const MONTH = new Intl.DateTimeFormat("tr-TR", { month: "long", timeZone: TIME_ZONE });

export function formatClock(instant: Date): string {
  return CLOCK.format(instant);
}

export function formatDayMonthTime(instant: Date): string {
  return DAY_MONTH_TIME.format(instant).replace(",", "");
}

export function formatMonth(instant: Date): string {
  const month = MONTH.format(instant);
  return month.charAt(0).toLocaleUpperCase("tr-TR") + month.slice(1);
}

// The run times on the 24-hour axis: each hourly interval is processed by
// the run that starts when it ends, so the last cell is this hour's run.
export function axisRunTimes(readAt: Date): { first: Date; last: Date } {
  const last = new Date(Math.floor(readAt.getTime() / HOUR_MS) * HOUR_MS);
  return { first: new Date(last.getTime() - (STAGE_HOURS - 1) * HOUR_MS), last };
}

// A stage's state now: its latest judged hour (cells without a record, such
// as an hour still pending, are passed over), or its last run before any
// history.
export function currentStageState(cells: CellState[], lastRunStatus: string | null): CellState {
  for (let index = cells.length - 1; index >= 0; index -= 1) {
    const cell = cells[index];
    if (cell !== undefined && cell !== "none") {
      return cell;
    }
  }
  return lastRunStatus === COMPLETE ? "ok" : "failed";
}

export function minutesBetween(earlier: Date, later: Date): number {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / (MINUTE_SECONDS * 1000)));
}

// Seconds and minutes for step durations; hours and minutes once a duration
// passes an hour (lead and recovery times), where seconds add nothing.
export function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  if (whole < MINUTE_SECONDS) {
    return `${whole} sn`;
  }
  if (whole >= HOUR_SECONDS) {
    const hours = Math.floor(whole / HOUR_SECONDS);
    const minutes = Math.floor((whole % HOUR_SECONDS) / MINUTE_SECONDS);
    return minutes === 0 ? `${hours} sa` : `${hours} sa ${minutes} dk`;
  }
  const minutes = Math.floor(whole / MINUTE_SECONDS);
  const rest = whole % MINUTE_SECONDS;
  return rest === 0 ? `${minutes} dk` : `${minutes} dk ${rest} sn`;
}

const INTEGER = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
const ONE_DECIMAL = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });

export function formatCount(value: number): string {
  return INTEGER.format(value);
}

const BYTE_UNITS: [number, string][] = [
  [1e9, "GB"],
  [1e6, "MB"],
  [1e3, "KB"],
];

// Decimal units, as Google's free-tier page writes them.
export function formatBytes(bytes: number): string {
  for (const [size, unit] of BYTE_UNITS) {
    if (bytes >= size) {
      const value = bytes / size;
      return `${value >= 100 ? INTEGER.format(value) : ONE_DECIMAL.format(value)} ${unit}`;
    }
  }
  return `${INTEGER.format(bytes)} B`;
}

// Rounded down, so a share never reads as better than it is.
export function formatPercent(share: number): string {
  const percent = share * 100;
  const digits = percent > 0 && percent < 1 ? 2 : 1;
  const factor = 10 ** digits;
  const floored = Math.floor(percent * factor) / factor;
  const text = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: digits }).format(floored);
  return `%${text}`;
}

export function isBytes(allowance: string): boolean {
  return allowance.endsWith("_bytes");
}
