// B16: a week after a deal is won, a task to thank the customer and ask for a referral. Once per deal, ever: the
// partial unique index task_one_won_follow_up decides, so moving out of Won and back, or two tabs moving it at once,
// never adds a second.
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { addDays } from "@/lib/dates";
import { company, contact, deal, task } from "@/lib/db/schema";
import { wonFollowUpTitle } from "@/lib/task-automations";

export const WON_FOLLOW_UP_DAYS = 7;

// The day the follow-up is due: the deal's won day (the business's day, YYYY-MM-DD) plus a week.
export function wonFollowUpDue(wonOn: string): string {
  return addDays(wonOn, WON_FOLLOW_UP_DAYS);
}

// Call after a deal reaches Won (added at Won, or moved there from another stage). Names are read as they are now.
// Returns whether a task was added: false when the deal has gone, isn't won, or already had its follow-up.
export async function addWonFollowUp(db: Db, dealId: string): Promise<boolean> {
  const [found] = await db.select({ wonOn: deal.wonOn, contactName: contact.name, companyName: company.name })
    .from(deal)
    .leftJoin(contact, eq(deal.contactId, contact.id))
    .leftJoin(company, eq(deal.companyId, company.id))
    .where(eq(deal.id, dealId)).limit(1);
  if (!found?.wonOn) return false;
  const added = await db.insert(task).values({
    title: wonFollowUpTitle(found), dueOn: wonFollowUpDue(found.wonOn), dealId, automation: "won_follow_up",
  }).onConflictDoNothing().returning({ id: task.id });
  return added.length > 0;
}
