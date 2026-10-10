// Dates on screen read "12 Oct 2026" (DESIGN.md). Built by hand rather than with Intl: ICU versions disagree on
// September ("Sep" or "Sept"), and a calendar day has no time zone to convert.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// day is YYYY-MM-DD, as Postgres returns a date column
export function formatDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return `${date} ${MONTHS[month - 1]} ${year}`;
}
