import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { listCompanyChoices } from "@/lib/companies";
import { getContact } from "@/lib/contacts";
import { db } from "@/lib/db/client";
import { updateContactAction } from "../../actions";
import { ContactForm } from "../../contact-form";

export const metadata: Metadata = { title: "Edit contact" };

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const c = await getContact(db, id);
  if (!c) notFound();
  const companies = await listCompanyChoices(db);
  const initial = {
    name: c.name, email: c.email ?? "", phone: c.phone ?? "", jobTitle: c.jobTitle ?? "", notes: c.notes ?? "", companyId: c.companyId ?? "",
  };
  return (
    <main className="max-w-xl px-6 py-12 md:px-12">
      <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Edit {c.name}</h1>
      <div className="mt-8 border-t border-rule pt-6">
        <ContactForm action={updateContactAction.bind(null, c.id)} initial={initial} companies={companies} submitLabel="Save" cancelHref={`/contacts/${c.id}`} />
      </div>
    </main>
  );
}
