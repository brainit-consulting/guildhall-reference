import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { listCompanyChoices } from "@/lib/companies";
import { listContactChoices } from "@/lib/contacts";
import { db } from "@/lib/db/client";
import { getDeal } from "@/lib/deals";
import { updateDealAction } from "../../actions";
import { DealForm } from "../../deal-form";

export const metadata: Metadata = { title: "Edit deal" };

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const d = await getDeal(db, id);
  if (!d) notFound();
  const [contacts, companies] = await Promise.all([listContactChoices(db), listCompanyChoices(db)]);
  const initial = {
    title: d.title, value: d.value ?? "", stage: d.stage, contactId: d.contactId ?? "", companyId: d.companyId ?? "", expectedClose: d.expectedClose ?? "",
  };
  return (
    <main className="max-w-xl px-6 py-12 md:px-12">
      <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Edit {d.title}</h1>
      <div className="mt-8 border-t border-rule pt-6">
        <DealForm action={updateDealAction.bind(null, d.id)} initial={initial} contacts={contacts} companies={companies} submitLabel="Save" cancelHref={`/deals/${d.id}`} />
      </div>
    </main>
  );
}
