// Which badges an application shows (ADR-0034), highest attention first.
// A closed-without-reply application shows no badge, only plain text.
import type { Application, BadgeTone } from "@/lib/applications";
import { strings } from "@/lib/strings";

export interface Badge {
  tone: BadgeTone;
  label: string;
  // What a screen reader says, when the label is a short form.
  spoken?: string;
}

function statusBadge(application: Application): Badge | null {
  switch (application.current_status) {
    case "rejected":
      return { tone: "danger", label: strings.status.rejected };
    case "in_progress":
      return { tone: "progress", label: strings.status.inProgress };
    case "applied":
      return { tone: "neutral", label: strings.status.applied };
    case null:
      return null;
  }
}

export function badgesFor(application: Application): Badge[] {
  if (application.is_closed_without_reply) {
    return [];
  }
  const badges: Badge[] = [];
  if (application.is_silent) {
    const days = application.days_since_last_event;
    badges.push({
      tone: "warning",
      label: strings.status.silentDays(days),
      spoken: strings.status.silentDaysSpoken(days),
    });
  }
  const status = statusBadge(application);
  if (status) {
    badges.push(status);
  }
  return badges;
}

// How long ago the last event was, shown under its date.
export function daysAgo(days: number): string {
  return days === 0 ? strings.lastActivity.today : strings.lastActivity.daysAgo(days);
}
