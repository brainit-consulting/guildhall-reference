import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getCompany } from "@/lib/companies";
import { db } from "@/lib/db/client";
import { updateCompanyAction } from "../../actions";
import { CompanyForm } from "../../company-form";

export const metadata: Metadata = { title: "Edit company · Guildhall" };

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const c = await getCompany(db, id);
  if (!c) notFound();
  const initial = { name: c.name, website: c.website ?? "", phone: c.phone ?? "", notes: c.notes ?? "" };
  return (
    <main className="max-w-xl px-6 py-12 md:px-12">
      <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Edit {c.name}</h1>
      <div className="mt-8 border-t border-rule pt-6">
        <CompanyForm action={updateCompanyAction.bind(null, c.id)} initial={initial} submitLabel="Save" cancelHref={`/companies/${c.id}`} />
      </div>
    </main>
  );
}
