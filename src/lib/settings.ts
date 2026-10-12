// The business's own settings (I11), one row. Read with defaults, so a new copy works before anyone saves them.
import type { Db } from "@/lib/db/client";
import { businessSettings } from "@/lib/db/schema";
import { parseTaxRate } from "@/lib/invoice-totals";

// "15.00" means 15%. "0.00" until the owner sets one.
export async function getTaxRate(db: Db): Promise<string> {
  const [row] = await db.select({ taxRate: businessSettings.taxRate }).from(businessSettings).limit(1);
  return row?.taxRate ?? "0.00";
}

// Changes the rate for invoices made from now on; invoices already made keep theirs.
export async function setTaxRate(db: Db, typed: string, now = new Date()): Promise<{ value: string; error: null } | { value: null; error: string }> {
  const parsed = parseTaxRate(typed);
  if (parsed.value === null) return parsed;
  await db.insert(businessSettings).values({ id: 1, taxRate: parsed.value, updatedAt: now })
    .onConflictDoUpdate({ target: businessSettings.id, set: { taxRate: parsed.value, updatedAt: now } });
  return parsed;
}
