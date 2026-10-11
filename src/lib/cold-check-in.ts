// The cold check-in (B16): each deal going cold gets one "Check in with Ann Lee about Kitchen refit" task, due today,
// per cold spell. A spell is the deal's coalesce(last_activity_at, created_at), kept in task.cold_since, so logging
// anything on the deal starts a new one. No timer: Home calls this as it loads.
import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { TIME_ZONE, todayIn } from "@/lib/dates";
import { deal, task } from "@/lib/db/schema";
import { coldDeals, coldWhere } from "@/lib/deals";
import { checkInTitle } from "@/lib/task-automations";

// Two queries however many deals: the cold deals with their names (for the titles), then one insert. The insert
// re-checks the deal is still cold and has no open check-in, from this spell or an earlier one, and takes cold_since
// from the row itself. A check-in for this spell already ticked done collides with task_one_check_in_per_cold_spell,
// as does one made by a second tab at the same moment; on conflict do nothing keeps the first.
export async function checkInColdDeals(db: Db, now: Date): Promise<void> {
  const cold = await coldDeals(db, now);
  if (cold.length === 0) return;
  const titles = sql.join(
    cold.map((d) => sql`(${d.id}::uuid, ${checkInTitle({ contactName: d.contactName, companyName: d.companyName, dealTitle: d.title })})`),
    sql`, `,
  );
  await db.execute(sql`
    insert into ${task} (title, due_on, deal_id, automation, cold_since)
    select v.title, ${todayIn(TIME_ZONE, now)}::date, ${deal.id}, 'cold_check_in',
      coalesce(${deal.lastActivityAt}, ${deal.createdAt})
    from (values ${titles}) as v(deal_id, title)
    join ${deal} on ${deal.id} = v.deal_id
    where ${coldWhere(now)}
      and not exists (select 1 from ${task} where ${task.dealId} = ${deal.id}
        and ${task.automation} = 'cold_check_in' and ${task.doneAt} is null)
    on conflict do nothing`);
}
