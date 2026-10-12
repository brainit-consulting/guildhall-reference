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

export const MAX_ADDRESS_LINES = 6;
export const MAX_ADDRESS_LINE = 80;

// What was typed in the address box to the stored form: each line trimmed, blank lines dropped, "\n" between them. ""
// clears it. Short enough to sit under the business name on an invoice without pushing the lines onto a second page.
export function parseAddress(typed: string): { value: string; error: null } | { value: null; error: string } {
  const lines = typed.split(/\r?\n/).map((l) => l.trim().replace(/\s+/g, " ")).filter(Boolean);
  if (lines.length > MAX_ADDRESS_LINES) return { value: null, error: `Fit the address on ${MAX_ADDRESS_LINES} lines or fewer.` };
  if (lines.some((l) => l.length > MAX_ADDRESS_LINE)) {
    return { value: null, error: `Keep each line under ${MAX_ADDRESS_LINE} characters; press Enter to start a new line.` };
  }
  return { value: lines.join("\n"), error: null };
}

// "" until the owner sets one.
export async function getBusinessAddress(db: Db): Promise<string> {
  const [row] = await db.select({ address: businessSettings.address }).from(businessSettings).limit(1);
  return row?.address ?? "";
}

// The address printed on invoice PDFs, old and new: it is the business's address now, not a copy kept per invoice.
export async function setBusinessAddress(db: Db, typed: string, now = new Date()): Promise<{ value: string; error: null } | { value: null; error: string }> {
  const parsed = parseAddress(typed);
  if (parsed.value === null) return parsed;
  await db.insert(businessSettings).values({ id: 1, address: parsed.value, updatedAt: now })
    .onConflictDoUpdate({ target: businessSettings.id, set: { address: parsed.value, updatedAt: now } });
  return parsed;
}
