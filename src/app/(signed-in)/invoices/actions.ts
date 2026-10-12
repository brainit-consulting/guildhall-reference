"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { advanceInvoice, createInvoice, deleteInvoice, updateInvoice, type InvoiceErrors, type InvoiceInput } from "@/lib/invoices";

// Each action checks the session itself: server actions can be called by anyone who can send a POST.

// `attempt` changes on every refused save, so the form remounts with what was typed rather than React's reset.
export type InvoiceFormState = { errors: InvoiceErrors; values: InvoiceInput; attempt: number };

// The lines come as repeated fields, one of each per row, in the order they're on the form.
function read(form: FormData): InvoiceInput {
  const field = (name: string) => String(form.get(name) ?? "");
  const all = (name: string) => form.getAll(name).map(String);
  const [descriptions, quantities, prices] = [all("description"), all("quantity"), all("unitPrice")];
  return {
    clientId: field("clientId"), projectId: field("projectId"), issueOn: field("issueOn"), dueOn: field("dueOn"),
    lines: descriptions.map((description, i) => ({ description, quantity: quantities[i] ?? "", unitPrice: prices[i] ?? "" })),
  };
}

export async function createInvoiceAction(prev: InvoiceFormState, form: FormData): Promise<InvoiceFormState> {
  await requireSession();
  const values = read(form);
  const saved = await createInvoice(db, values);
  if (saved.errors) return { errors: saved.errors, values, attempt: prev.attempt + 1 };
  redirect(`/invoices/${saved.id}`);
}

export async function updateInvoiceAction(id: string, prev: InvoiceFormState, form: FormData): Promise<InvoiceFormState> {
  await requireSession();
  const values = read(form);
  const saved = await updateInvoice(db, id, values);
  if (!saved) redirect("/invoices"); // deleted meanwhile
  if (saved.errors) return { errors: saved.errors, values, attempt: prev.attempt + 1 };
  redirect(`/invoices/${id}`);
}

// "Mark sent" and "Mark paid". A step already taken in another tab just shows the invoice as it is now.
export async function advanceInvoiceAction(form: FormData) {
  await requireSession();
  const id = String(form.get("id") ?? "");
  await advanceInvoice(db, id, String(form.get("status") ?? ""));
  redirect(`/invoices/${id}`);
}

// Only a Draft goes; asked of a Sent one (sent in another tab), it stays and its page shows why.
export async function deleteInvoiceAction(form: FormData) {
  await requireSession();
  const id = String(form.get("id") ?? "");
  if (!(await deleteInvoice(db, id))) redirect(`/invoices/${id}`);
  redirect("/invoices");
}
