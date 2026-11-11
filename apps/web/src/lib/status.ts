// Which badge a row shows (ADR-0034, one badge per status since ADR-0052).
// An application's silence rides inside its status badge as "N+" days, in
// the attention color, so a waiting application that needs a follow-up
// still stands out.
import type { Application } from "@/lib/applications";
import type { Posting } from "@/lib/postings";
import { strings } from "@/lib/strings";

// One meaning per tone (ADR-0052): attention is progress or delay, error a
// rejection, ok done, accent new, waiting a hollow ring, closed no dot.
export type BadgeTone = "attention" | "error" | "ok" | "accent" | "waiting" | "closed";

export interface Badge {
  tone: BadgeTone;
  label: string;
  // Days of silence: shown short ("27+"), heard in full.
  silence?: { label: string; spoken: string };
}

function applicationStatus(application: Application): Badge | null {
  if (application.is_closed_without_reply) {
    return { tone: "closed", label: strings.status.closedWithoutReply };
  }
  switch (application.current_status) {
    case "rejected":
      return { tone: "error", label: strings.status.rejected };
    case "in_progress":
      return { tone: "attention", label: strings.status.inProgress };
    case "applied":
      return { tone: "waiting", label: strings.status.applied };
    case null:
      return null;
  }
}

// No badge when the status is unknown.
export function badgeFor(application: Application): Badge | null {
  const badge = applicationStatus(application);
  if (badge === null || !application.is_silent || badge.tone === "closed") {
    return badge;
  }
  const days = application.days_since_last_event;
  return {
    ...badge,
    silence: {
      label: strings.status.silentDays(days),
      spoken: strings.status.silentDaysSpoken(days),
    },
  };
}

const POSTING_TONE: Record<Posting["status"], BadgeTone> = {
  new: "accent",
  saved: "attention",
  applied: "ok",
};

export function postingBadge(posting: Posting, label: string): Badge {
  return { tone: POSTING_TONE[posting.status], label };
}

// How long ago the last event was, shown under its date.
export function daysAgo(days: number): string {
  return days === 0 ? strings.lastActivity.today : strings.lastActivity.daysAgo(days);
}
