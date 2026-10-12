"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { makeClient } from "@/lib/clients";
import { createDeal, deleteDeal, updateDeal, type DealErrors, type DealInput } from "@/lib/deals";

// Each action checks the session itself: server actions can be called by anyone who can send a POST.

// `attempt` changes on every refused save, so the form remounts with what was typed rather than React's reset.
export type DealFormState = { errors: DealErrors; values: DealInput; attempt: number };

function read(form: FormData): DealInput {
  const field = (name: string) => String(form.get(name) ?? "");
  return {
    title: field("title"), value: field("value"), stage: field("stage"),
    contactId: field("contactId"), companyId: field("companyId"), expectedClose: field("expectedClose"),
  };
}

export async function createDealAction(prev: DealFormState, form: FormData): Promise<DealFormState> {
  await requireSession();
  const values = read(form);
  const saved = await createDeal(db, values);
  if (saved.errors) return { errors: saved.errors, values, attempt: prev.attempt + 1 };
  redirect(`/deals/${saved.id}`);
}

export async function updateDealAction(id: string, prev: DealFormState, form: FormData): Promise<DealFormState> {
  const { user } = await requireSession();
  const values = read(form);
  const saved = await updateDeal(db, id, values, user.id); // a new stage is logged as theirs
  if (!saved) redirect("/deals"); // deleted meanwhile
  if (saved.errors) return { errors: saved.errors, values, attempt: prev.attempt + 1 };
  redirect(`/deals/${id}`);
}

export async function deleteDealAction(form: FormData) {
  await requireSession();
  await deleteDeal(db, String(form.get("id") ?? ""));
  redirect("/deals");
}

// "Make client" on a Won deal: off to the client it made or reused. The button only shows on a Won deal with a company
// or contact, so an error means the deal changed in another tab.
export async function makeClientAction(_prev: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  await requireSession();
  const made = await makeClient(db, String(form.get("id") ?? ""));
  if (!made) redirect("/deals"); // deleted meanwhile
  if (made.error) return { error: made.error };
  redirect(`/clients/${made.id}`);
}
