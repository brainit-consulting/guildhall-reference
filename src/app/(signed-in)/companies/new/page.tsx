import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { EMPTY_COMPANY } from "@/lib/companies";
import { createCompanyAction } from "../actions";
import { CompanyForm } from "../company-form";

export const metadata: Metadata = { title: "Add company · Guildhall" };

export default async function NewCompanyPage() {
  await requireSession();
  return (
    <main className="max-w-xl px-6 py-12 md:px-12">
      <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Add company</h1>
      <div className="mt-8 border-t border-rule pt-6">
        <CompanyForm action={createCompanyAction} initial={EMPTY_COMPANY} submitLabel="Add company" cancelHref="/companies" />
      </div>
    </main>
  );
}
