import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { listCompanyChoices } from "@/lib/companies";
import { listContactChoices } from "@/lib/contacts";
import { db } from "@/lib/db/client";
import { EMPTY_DEAL } from "@/lib/deals";
import { createDealAction } from "../actions";
import { DealForm } from "../deal-form";

export const metadata: Metadata = { title: "Add deal" };

export default async function NewDealPage() {
  await requireSession();
  const [contacts, companies] = await Promise.all([listContactChoices(db), listCompanyChoices(db)]);
  return (
    <main className="max-w-xl px-6 py-12 md:px-12">
      <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Add deal</h1>
      <div className="mt-8 border-t border-rule pt-6">
        <DealForm action={createDealAction} initial={EMPTY_DEAL} contacts={contacts} companies={companies} submitLabel="Add deal" cancelHref="/deals" />
      </div>
    </main>
  );
}
