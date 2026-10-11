import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { listCompanyChoices } from "@/lib/companies";
import { EMPTY_CONTACT } from "@/lib/contacts";
import { db } from "@/lib/db/client";
import { createContactAction } from "../actions";
import { ContactForm } from "../contact-form";

export const metadata: Metadata = { title: "Add contact" };

// ?company=<id> starts the form with that company picked (the "Add contact" link on a company's page).
export default async function NewContactPage({ searchParams }: { searchParams: Promise<{ company?: string | string[] }> }) {
  await requireSession();
  const { company } = await searchParams;
  const companies = await listCompanyChoices(db);
  const initial = { ...EMPTY_CONTACT, companyId: typeof company === "string" ? company : "" };
  return (
    <main className="max-w-xl px-6 py-12 md:px-12">
      <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Add contact</h1>
      <div className="mt-8 border-t border-rule pt-6">
        <ContactForm action={createContactAction} initial={initial} companies={companies} submitLabel="Add contact" cancelHref="/contacts" />
      </div>
    </main>
  );
}
