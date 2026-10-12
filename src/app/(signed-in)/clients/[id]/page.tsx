import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getClient, listClientWonDeals } from "@/lib/clients";
import { formatDay, TIME_ZONE, todayIn } from "@/lib/dates";
import { db } from "@/lib/db/client";
import { listInvoices } from "@/lib/invoices";
import { formatMoney } from "@/lib/money";
import { listClientProjects } from "@/lib/projects";
import { InvoiceSection } from "../../invoices/invoice-section";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  await requireSession(); // the title holds the client's name, so it is guarded like the page
  const c = await getClient(db, (await params).id);
  return { title: c?.name ?? "Client" };
}

const link = "text-accent underline-offset-4 hover:underline";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const c = await getClient(db, id);
  if (!c) notFound();
  const [deals, projects, invoices] = await Promise.all([
    listClientWonDeals(db, c.id), listClientProjects(db, c.id), listInvoices(db, { clientId: c.id }),
  ]);

  // [label, value, what a blank one says]
  const fields: [string, React.ReactNode, string][] = [
    ["Company", c.companyId && <Link href={`/companies/${c.companyId}`} className={`tap-target ${link}`}>{c.companyName}</Link>,
      c.madeFrom === "company" ? "Deleted" : "No company"],
    ["Contact person", c.contactId && <Link href={`/contacts/${c.contactId}`} className={`tap-target ${link}`}>{c.contactName}</Link>, "No contact"],
    // the business's day it was made
    ["Client since", formatDay(todayIn(TIME_ZONE, c.createdAt)), ""],
  ];

  return (
    <main className="max-w-2xl px-6 py-12 md:px-12">
      <Link href="/clients" className={`text-sm ${link}`}>Clients</Link>
      <h1 className="mt-2 font-display text-4xl text-ink -ml-px md:-ml-6 wrap-anywhere">{c.name}</h1>

      <dl className="mt-8 border-t border-rule">
        {fields.map(([label, value, blank]) => (
          <div key={label} className="grid gap-1 border-b border-rule py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className={value ? "break-words text-ink" : "text-muted"}>{value || blank}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="projects" className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 id="projects" className="font-display text-2xl text-ink">Projects</h2>
          <Link href={`/projects/new?client=${c.id}`} className="inline-flex h-10 items-center rounded-sm bg-accent px-4 text-sm font-medium text-paper hover:opacity-90">
            Add project
          </Link>
        </div>
        {projects.length === 0 ? (
          <p className="mt-4 border-t border-rule pt-4 text-muted">No projects for this client yet.</p>
        ) : (
          <ul aria-label="Projects" className="mt-4 border-t border-rule">
            {projects.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule py-3">
                <Link href={`/projects/${p.id}`} className={`tap-target wrap-anywhere ${link}`}>{p.name}</Link>
                <span className="text-sm text-muted">
                  {p.status} · {formatDay(p.startOn)} to {formatDay(p.endOn)}
                  <span className="ml-3 tabular-nums text-ink">{formatMoney(p.budget)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <InvoiceSection invoices={invoices} newHref={`/invoices/new?client=${c.id}`} empty="No invoices for this client yet." />

      <section aria-labelledby="won-deals" className="mt-12">
        <h2 id="won-deals" className="font-display text-2xl text-ink">Won deals</h2>
        {deals.length === 0 ? (
          <p className="mt-4 border-t border-rule pt-4 text-muted">No won deals linked to this client.</p>
        ) : (
          <ul aria-label="Won deals" className="mt-4 border-t border-rule">
            {deals.map((d) => (
              <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule py-3">
                <Link href={`/deals/${d.id}`} className={`tap-target wrap-anywhere ${link}`}>{d.title}</Link>
                <span className="text-sm text-muted">
                  {d.wonOn && <>Won {formatDay(d.wonOn)}</>}
                  {d.value && <span className="ml-3 tabular-nums text-ink">{formatMoney(d.value)}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
