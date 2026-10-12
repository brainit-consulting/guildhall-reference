import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { listClients } from "@/lib/clients";
import { db } from "@/lib/db/client";
import { formatInvoiceNumber, getInvoice, listProjectChoices } from "@/lib/invoices";
import { updateInvoiceAction } from "../../actions";
import { InvoiceForm } from "../../invoice-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  await requireSession();
  const i = await getInvoice(db, (await params).id);
  return { title: i ? `Edit ${formatInvoiceNumber(i.number)}` : "Edit invoice" };
}

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const i = await getInvoice(db, id);
  if (!i) notFound();
  if (i.status !== "Draft") redirect(`/invoices/${i.id}`); // only a Draft is edited
  const [clients, projects] = await Promise.all([listClients(db), listProjectChoices(db)]);
  const initial = { clientId: i.clientId, projectId: i.projectId ?? "", issueOn: i.issueOn, dueOn: i.dueOn, lines: i.lines };
  return (
    <main className="max-w-3xl px-6 py-12 md:px-12">
      <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Edit {formatInvoiceNumber(i.number)}</h1>
      <div className="mt-8 border-t border-rule pt-6">
        <InvoiceForm action={updateInvoiceAction.bind(null, i.id)} initial={initial} clients={clients} projects={projects}
          taxRate={i.taxRate} submitLabel="Save" cancelHref={`/invoices/${i.id}`} />
      </div>
    </main>
  );
}
