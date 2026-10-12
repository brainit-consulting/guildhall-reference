import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { listClients } from "@/lib/clients";
import { addDays, TIME_ZONE, todayIn } from "@/lib/dates";
import { db } from "@/lib/db/client";
import { listProjectChoices } from "@/lib/invoices";
import { getTaxRate } from "@/lib/settings";
import { createInvoiceAction } from "../actions";
import { InvoiceForm } from "../invoice-form";

export const metadata: Metadata = { title: "New invoice" };

// Days from issue to due on a new invoice; the form can change it.
const PAYMENT_DAYS = 30;

const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);

// "New invoice" on a client's page opens this with ?client=<id>, on a project's page with ?project=<id>, so the
// client (and project) are already picked.
export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ client?: string | string[]; project?: string | string[] }> }) {
  await requireSession();
  const asked = await searchParams;
  const [clients, projects, taxRate] = await Promise.all([listClients(db), listProjectChoices(db), getTaxRate(db)]);
  const project = projects.find((p) => p.id === first(asked.project));
  const client = clients.find((c) => c.id === (project?.clientId ?? first(asked.client)));
  const today = todayIn(TIME_ZONE, new Date());
  const initial = {
    clientId: client?.id ?? "", projectId: project?.id ?? "", issueOn: today, dueOn: addDays(today, PAYMENT_DAYS), lines: [],
  };
  const cancelHref = project ? `/projects/${project.id}` : client ? `/clients/${client.id}` : "/invoices";
  return (
    <main className="max-w-3xl px-6 py-12 md:px-12">
      <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">New invoice</h1>
      {clients.length === 0 ? (
        <p className="mt-8 border-t border-rule pt-6 text-muted">
          You have no clients to bill yet. Make one from a Won deal: open the deal and press Make client.
        </p>
      ) : (
        <div className="mt-8 border-t border-rule pt-6">
          <InvoiceForm action={createInvoiceAction} initial={initial} clients={clients} projects={projects} taxRate={taxRate}
            submitLabel="Save draft" cancelHref={cancelHref} />
        </div>
      )}
    </main>
  );
}
