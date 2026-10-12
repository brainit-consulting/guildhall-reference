import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";
import { db } from "@/lib/db/client";
import { listInvoices } from "@/lib/invoices";
import { formatMoney } from "@/lib/money";
import { getProject } from "@/lib/projects";
import { InvoiceSection } from "../../invoices/invoice-section";
import { DeleteProject } from "./delete-project";
import { SetStatus } from "./set-status";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  await requireSession(); // the title holds the project's name, so it is guarded like the page
  const p = await getProject(db, (await params).id);
  return { title: p?.name ?? "Project" };
}

const link = "text-accent underline-offset-4 hover:underline";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const p = await getProject(db, id);
  if (!p) notFound();
  const invoices = await listInvoices(db, { projectId: p.id });

  const fields: [string, React.ReactNode][] = [
    ["Client", <Link key="client" href={`/clients/${p.clientId}`} className={`tap-target ${link}`}>{p.clientName}</Link>],
    ["Status", p.status],
    ["Budget", <span key="budget" className="tabular-nums">{formatMoney(p.budget)}</span>],
    ["Start", formatDay(p.startOn)],
    ["End", formatDay(p.endOn)],
  ];

  return (
    <main className="max-w-2xl px-6 py-12 md:px-12">
      <Link href="/projects" className={`tap-target text-sm ${link}`}>Projects</Link>
      <h1 className="mt-2 font-display text-4xl text-ink -ml-px md:-ml-6 wrap-anywhere">{p.name}</h1>

      <dl className="mt-8 border-t border-rule">
        {fields.map(([label, value]) => (
          <div key={label} className="grid gap-1 border-b border-rule py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="break-words text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href={`/projects/${p.id}/edit`} className="inline-flex h-10 items-center rounded-sm border border-rule bg-panel px-4 text-sm font-medium text-ink hover:border-ink">
          Edit
        </Link>
        <SetStatus id={p.id} status={p.status} />
        <DeleteProject id={p.id} name={p.name} />
      </div>

      <InvoiceSection invoices={invoices} newHref={`/invoices/new?project=${p.id}`} empty="No invoices for this project yet." />
    </main>
  );
}
