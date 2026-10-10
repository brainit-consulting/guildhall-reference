import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { EMPTY_CONTACT } from "@/lib/contacts";
import { createContactAction } from "../actions";
import { ContactForm } from "../contact-form";

export const metadata: Metadata = { title: "Add contact · Guildhall" };

export default async function NewContactPage() {
  await requireSession();
  return (
    <main className="max-w-xl px-6 py-12 md:px-12">
      <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Add contact</h1>
      <div className="mt-8 border-t border-rule pt-6">
        <ContactForm action={createContactAction} initial={EMPTY_CONTACT} submitLabel="Add contact" cancelHref="/contacts" />
      </div>
    </main>
  );
}
