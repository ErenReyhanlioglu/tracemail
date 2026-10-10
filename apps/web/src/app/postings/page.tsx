// Incoming postings (step 1.10): every posting seen in a job mail, newest
// first, filtered by period and by what the owner did with it. Filtering and
// paging happen in the API; this page fetches one page on the server.
import { redirect } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { ChipGroup } from "@/components/ChipGroup";
import { Pagination } from "@/components/Pagination";
import { PostingTable } from "@/components/PostingTable";
import { fetchPostings } from "@/lib/api";
import { loadPrivate } from "@/lib/load";
import { type ListLocation, listUrl, pageCount, parsePageSize } from "@/lib/paging";
import {
  parsePeriod,
  parseStatusFilter,
  type Period,
  PERIOD_DAYS,
  PERIODS,
  postingsQuery,
  STATUS_FILTERS,
  type StatusFilter,
} from "@/lib/postings";
import { strings } from "@/lib/strings";

import styles from "../list.module.css";

export const dynamic = "force-dynamic";

const PATH = "/postings";
const text = strings.postings;

function location(status: StatusFilter, period: Period): ListLocation {
  return { path: PATH, query: postingsQuery(status, period) };
}

export default async function PostingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; period?: string; page?: string; size?: string }>;
}) {
  const params = await searchParams;
  const status = parseStatusFilter(params.status);
  const period = parsePeriod(params.period);
  const size = parsePageSize(params.size);
  const requested = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const data = await loadPrivate(() =>
    fetchPostings({ status, days: PERIOD_DAYS[period], page: requested, pageSize: size }),
  );
  if (data && data.items.length === 0 && data.total > 0) {
    // Past the last page (a stale link or a smaller filter): open the last one.
    redirect(listUrl(location(status, period), pageCount(data.total, size), size));
  }
  return (
    <AppShell active="postings">
      <header className={styles.header}>
        <h1 className={styles.title}>{text.title}</h1>
        {data ? (
          <span className={styles.summary}>
            {text.summary(data.counts.all, text.periodsInSummary[period])}
          </span>
        ) : null}
      </header>
      {data === null ? (
        <p className={styles.message}>{strings.errors.unavailable}</p>
      ) : (
        <>
          <div className={styles.filters}>
            <ChipGroup
              label={text.periodLabel}
              chips={PERIODS.map((option) => ({
                key: option,
                label: text.periods[option],
                href: listUrl(location(status, option), 1, size),
                active: option === period,
              }))}
            />
            <ChipGroup
              label={text.statusLabel}
              chips={STATUS_FILTERS.map((option) => ({
                key: option,
                label: text.filters[option],
                count: data.counts[option],
                href: listUrl(location(option, period), 1, size),
                active: option === status,
              }))}
            />
          </div>
          {data.total === 0 ? (
            <p className={styles.message}>{text.empty}</p>
          ) : (
            <PostingTable
              postings={data.items}
              footer={
                <Pagination
                  location={location(status, period)}
                  page={data.page}
                  size={size}
                  total={data.total}
                  noun={text.noun}
                />
              }
            />
          )}
          <p className={styles.note}>{text.laterNote}</p>
        </>
      )}
    </AppShell>
  );
}
