// Going cold (B14): an open deal with nothing logged for COLD_DAYS of the business's calendar days. No database
// imports, so Home, the Deals list and B16's cold check-in share the rule; deals.ts holds the matching query.
import { addDays, dayStartIn, daysBetween, TIME_ZONE, todayIn } from "@/lib/dates";
import { isOpen, type DealStage } from "@/lib/deal-stages";

export const COLD_DAYS = 14;

// What the rule reads from a deal. lastActivityAt already counts stage changes and activity on its contact and company.
export type ColdCheck = { stage: DealStage; lastActivityAt: Date | null; createdAt: Date };

// Calendar days since the deal was last touched, or added when nothing was ever logged: the 16 in "Nothing for 16
// days". Days are the business's (TIME_ZONE), so the hour of the last call doesn't matter.
export function quietDays(deal: ColdCheck, now: Date): number {
  const last = deal.lastActivityAt ?? deal.createdAt;
  return Math.max(0, daysBetween(todayIn(TIME_ZONE, last), todayIn(TIME_ZONE, now))); // a clock a little behind
}

export function isCold(deal: ColdCheck, now: Date): boolean {
  return isOpen(deal.stage) && quietDays(deal, now) >= COLD_DAYS;
}

// The same line as an instant, for the database: a deal last touched before this is going cold at `now`. It is the
// moment the business's day `today - 13` began, so last touched on `today - 14` or earlier.
export function coldBefore(now: Date): Date {
  return dayStartIn(TIME_ZONE, addDays(todayIn(TIME_ZONE, now), -(COLD_DAYS - 1)));
}
