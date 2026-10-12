"use server";

import { refresh } from "next/cache";
import { addAllowedEmail, removeAllowedEmail } from "@/lib/access";
import { disconnectAgent } from "@/lib/connections";
import { requireOwner } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { resetDemoData, resetMessage } from "@/lib/demo-data";
import { env } from "@/lib/env";
import { setBusinessAddress, setTaxRate } from "@/lib/settings";

// Each action checks the owner itself: server actions can be called by anyone who can send a POST.

export async function addAllowedEmailAction(_prev: { error: string | null }, form: FormData) {
  await requireOwner();
  const result = await addAllowedEmail(db, String(form.get("email") ?? ""));
  if (!result.error) refresh();
  return result;
}

export async function removeAllowedEmailAction(form: FormData) {
  await requireOwner();
  await removeAllowedEmail(db, String(form.get("id") ?? ""));
  refresh();
}

export type ResetState = { error: string | null; message: string | null };

// resetDemoData refuses too when DEMO_EMAIL isn't set, so a POST to a copy without it wipes nothing.
export async function resetDemoDataAction(): Promise<ResetState> {
  const s = await requireOwner();
  const result = await resetDemoData(db, s.user, env.demoEmail);
  if (result.counts === null) return { error: result.error, message: null };
  refresh();
  return { error: null, message: resetMessage(result.counts) };
}

// I9: withdraws an agent's consent and tokens; its next call to /mcp is refused.
export async function disconnectAgentAction(form: FormData) {
  await requireOwner();
  await disconnectAgent(db, String(form.get("clientId") ?? ""), String(form.get("userId") ?? ""));
  refresh();
}

export type TaxRateState = { error: string | null; saved: string | null; typed: string };

// I11: the rate copied onto invoices made from now on.
export async function setTaxRateAction(_prev: TaxRateState, form: FormData): Promise<TaxRateState> {
  await requireOwner();
  const typed = String(form.get("taxRate") ?? "");
  const result = await setTaxRate(db, typed);
  if (result.value === null) return { error: result.error, saved: null, typed };
  refresh();
  return { error: null, saved: result.value, typed: result.value };
}

export type AddressState = { error: string | null; saved: boolean; typed: string };

// I11: the address printed on invoice PDFs.
export async function setAddressAction(_prev: AddressState, form: FormData): Promise<AddressState> {
  await requireOwner();
  const typed = String(form.get("address") ?? "");
  const result = await setBusinessAddress(db, typed);
  if (result.value === null) return { error: result.error, saved: false, typed };
  refresh();
  return { error: null, saved: true, typed: result.value };
}
