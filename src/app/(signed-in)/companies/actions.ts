"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { createCompany, deleteCompany, updateCompany, type CompanyErrors, type CompanyInput } from "@/lib/companies";
import { db } from "@/lib/db/client";

// Each action checks the session itself: server actions can be called by anyone who can send a POST.

// `attempt` changes on every refused save, so the form remounts with what was typed rather than React's reset.
export type CompanyFormState = { errors: CompanyErrors; values: CompanyInput; attempt: number };

function read(form: FormData): CompanyInput {
  const field = (name: string) => String(form.get(name) ?? "");
  return { name: field("name"), website: field("website"), phone: field("phone"), notes: field("notes") };
}

export async function createCompanyAction(prev: CompanyFormState, form: FormData): Promise<CompanyFormState> {
  await requireSession();
  const values = read(form);
  const saved = await createCompany(db, values);
  if (saved.errors) return { errors: saved.errors, values, attempt: prev.attempt + 1 };
  redirect(`/companies/${saved.id}`);
}

export async function updateCompanyAction(id: string, prev: CompanyFormState, form: FormData): Promise<CompanyFormState> {
  await requireSession();
  const values = read(form);
  const saved = await updateCompany(db, id, values);
  if (!saved) redirect("/companies"); // deleted meanwhile
  if (saved.errors) return { errors: saved.errors, values, attempt: prev.attempt + 1 };
  redirect(`/companies/${id}`);
}

export async function deleteCompanyAction(form: FormData) {
  await requireSession();
  await deleteCompany(db, String(form.get("id") ?? ""));
  redirect("/companies");
}
