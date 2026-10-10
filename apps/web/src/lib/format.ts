// Date formatting for display: Turkish, in the owner's time zone. API dates
// are calendar dates (YYYY-MM-DD) and are formatted as such, never shifted.

const DAY_MONTH = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function formatDayMonth(isoDate: string): string {
  return DAY_MONTH.format(new Date(`${isoDate}T00:00:00Z`));
}
