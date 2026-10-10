"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { createContact, deleteContact, updateContact, type ContactErrors, type ContactInput } from "@/lib/contacts";
import { db } from "@/lib/db/client";

// Each action checks the session itself: server actions can be called by anyone who can send a POST.

// `attempt` changes on every refused save, so the form remounts with what was typed rather than React's reset.
export type ContactFormState = { errors: ContactErrors; values: ContactInput; attempt: number };

function read(form: FormData): ContactInput {
  const field = (name: string) => String(form.get(name) ?? "");
  return { name: field("name"), email: field("email"), phone: field("phone"), jobTitle: field("jobTitle"), notes: field("notes") };
}

export async function createContactAction(prev: ContactFormState, form: FormData): Promise<ContactFormState> {
  await requireSession();
  const values = read(form);
  const saved = await createContact(db, values);
  if (saved.errors) return { errors: saved.errors, values, attempt: prev.attempt + 1 };
  redirect(`/contacts/${saved.id}`);
}

export async function updateContactAction(id: string, prev: ContactFormState, form: FormData): Promise<ContactFormState> {
  await requireSession();
  const values = read(form);
  const saved = await updateContact(db, id, values);
  if (!saved) redirect("/contacts"); // deleted meanwhile
  if (saved.errors) return { errors: saved.errors, values, attempt: prev.attempt + 1 };
  redirect(`/contacts/${id}`);
}

export async function deleteContactAction(form: FormData) {
  await requireSession();
  await deleteContact(db, String(form.get("id") ?? ""));
  redirect("/contacts");
}
