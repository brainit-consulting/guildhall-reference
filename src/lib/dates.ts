// Dates on screen read "12 Oct 2026" (DESIGN.md). Built by hand rather than with Intl: ICU versions disagree on
// September ("Sep" or "Sept"), and a calendar day has no time zone to convert.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The business's time zone: its "today" decides what is overdue, wherever the server or the reader is. A fact about
// the business, like CURRENCY in money.ts; this is the one line to change.
export const TIME_ZONE = "America/New_York";

// The calendar day (YYYY-MM-DD) it is at `now` in `timeZone`. Numeric parts only, so ICU's month names don't matter.
export function todayIn(timeZone: string, now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// The calendar month (YYYY-MM) it is at `now` in `timeZone`: the last evening of October in New York is still
// October, though UTC is already in November.
export function monthIn(timeZone: string, now: Date): string {
  return todayIn(timeZone, now).slice(0, 7);
}

// A real month as YYYY-MM: "2026-13" and "2026-1" are refused.
export function isMonth(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
  "November", "December"];

// "2026-10" reads "October 2026"; by hand, like formatDay.
export function formatMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${year}`;
}

// The first day of the month after a YYYY-MM, as YYYY-MM-DD: "2026-12" gives "2027-01-01".
export function nextMonthStart(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return m === 12 ? `${year + 1}-01-01` : `${year}-${String(m + 1).padStart(2, "0")}-01`;
}

// Where a due day stands against today; both YYYY-MM-DD, which compare correctly as strings.
export function dueWhen(dueOn: string, today: string): "overdue" | "today" | "later" {
  if (dueOn < today) return "overdue";
  return dueOn === today ? "today" : "later";
}

// A real calendar day as YYYY-MM-DD: "2026-02-30" is refused rather than rolled into March.
export function isDay(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

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
