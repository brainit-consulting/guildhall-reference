"use server";

import { db } from "@/lib/db/client";
import { receiveEnquiry, thanksFor, type EnquiryErrors, type EnquiryInput } from "@/lib/enquiries";

// Public on purpose: anyone may send an enquiry, so there is no session check. receiveEnquiry keeps out bots and floods.

// `attempt` changes on every refused send, so the form remounts with what was typed rather than React's reset.
// `thanks` is set once the enquiry is taken (saved or ignored alike); the page shows it instead of the form.
export type EnquiryFormState = { errors: EnquiryErrors; values: EnquiryInput; attempt: number; thanks: string | null };

function read(form: FormData): EnquiryInput {
  const field = (name: string) => String(form.get(name) ?? "");
  return { name: field("name"), email: field("email"), phone: field("phone"), company: field("company"),
    message: field("message"), trap: field("website") };
}

export async function sendEnquiryAction(prev: EnquiryFormState, form: FormData): Promise<EnquiryFormState> {
  const values = read(form);
  const received = await receiveEnquiry(db, values);
  if (received.errors) return { errors: received.errors, values, attempt: prev.attempt + 1, thanks: null };
  return { errors: {}, values, attempt: prev.attempt, thanks: thanksFor(values.name) };
}
