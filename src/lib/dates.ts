// Dates on screen read "12 Oct 2026" (DESIGN.md). Built by hand rather than with Intl: ICU versions disagree on
// September ("Sep" or "Sept"), and a calendar day has no time zone to convert.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// day is YYYY-MM-DD, as Postgres returns a date column
export function formatDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return `${date} ${MONTHS[month - 1]} ${year}`;
}

// How long ago a day was, counted in calendar days: "today", "yesterday", "3 days ago". Both days are YYYY-MM-DD in
// the reader's own time zone, so a call at 11pm reads "yesterday" the next morning, not "today".
export function daysAgo(then: string, today: string): string {
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${then}T00:00:00Z`)) / 86_400_000);
  if (days <= 0) return "today"; // a clock a little ahead of the reader's
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
