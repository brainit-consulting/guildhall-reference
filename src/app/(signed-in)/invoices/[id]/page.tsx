import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { formatDay, TIME_ZONE, todayIn } from "@/lib/dates";
import { db } from "@/lib/db/client";
import { formatQuantity, formatTaxRate } from "@/lib/invoice-totals";
import { formatInvoiceNumber, getInvoice, isOverdue, NEXT_STATUS } from "@/lib/invoices";
import { formatMoney } from "@/lib/money";
import { StatusText } from "../status-text";
import { Advance } from "./advance";
import { DeleteInvoice } from "./delete-invoice";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  await requireSession(); // guarded like the page
  const i = await getInvoice(db, (await params).id);
  return { title: i ? formatInvoiceNumber(i.number) : "Invoice" };
}

const link = "text-accent underline-offset-4 hover:underline";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const i = await getInvoice(db, id);
  if (!i) notFound();
  const number = formatInvoiceNumber(i.number);
  const overdue = isOverdue(i, todayIn(TIME_ZONE, new Date()));
  const next = NEXT_STATUS[i.status];

  // [label, value, what a blank one says]
  const fields: [string, React.ReactNode, string?][] = [
    ["Client", <Link key="client" href={`/clients/${i.clientId}`} className={`tap-target ${link}`}>{i.clientName}</Link>],
    ["Project", i.projectId && <Link href={`/projects/${i.projectId}`} className={`tap-target ${link}`}>{i.projectName}</Link>, "No project"],
    ["Status", <StatusText key="status" status={i.status} overdue={overdue} />],
    ["Issue date", formatDay(i.issueOn)],
    ["Due date", formatDay(i.dueOn)],
  ];
  const totals: [string, string][] = [
    ["Subtotal", i.totals.subtotal], [`Tax (${formatTaxRate(i.taxRate)})`, i.totals.tax], ["Total", i.totals.total],
  ];

  return (
    <main className="max-w-3xl px-6 py-12 md:px-12">
      <Link href="/invoices" className={`tap-target text-sm ${link}`}>Invoices</Link>
      <h1 className="mt-2 font-display text-4xl text-ink -ml-px md:-ml-6">{number}</h1>

      <dl className="mt-8 border-t border-rule">
        {fields.map(([label, value, blank]) => (
          <div key={label} className="grid gap-1 border-b border-rule py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className={value ? "break-words text-ink" : "text-muted"}>{value || blank}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="lines" className="mt-12">
        <h2 id="lines" className="font-display text-2xl text-ink">Lines</h2>
        {/* Under 768px each line is a stacked block: the description, then quantity x price and the amount (DESIGN.md). */}
        <ol aria-label="Lines" className="mt-4 border-t border-rule md:hidden">
          {i.lines.map((l, n) => (
            <li key={n} className="border-b border-rule py-3">
              <p className="text-ink wrap-anywhere">{l.description}</p>
              <p className="mt-1 text-sm text-ink tabular-nums">
                <span className="text-muted">{formatQuantity(l.quantity)} x {formatMoney(l.unitPrice)}:</span> {formatMoney(i.totals.lines[n])}
              </p>
            </li>
          ))}
        </ol>
        <div className="mt-4 hidden md:block">
          <table aria-label="Lines" className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-rule bg-panel text-sm text-muted">
                <th scope="col" className="px-3 py-2 font-medium">Description</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Quantity</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Unit price</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {i.lines.map((l, n) => (
                <tr key={n} className="border-b border-rule">
                  <td className="px-3 py-2 text-ink wrap-anywhere">{l.description}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">{formatQuantity(l.quantity)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">{formatMoney(l.unitPrice)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">{formatMoney(i.totals.lines[n])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl aria-label="Totals" className="ml-auto mt-4 w-full max-w-xs border-t border-rule">
          {totals.map(([label, value]) => (
            <div key={label} className={`flex justify-between gap-4 border-b border-rule py-2 text-ink ${label === "Total" ? "font-medium" : ""}`}>
              <dt className={label === "Total" ? "" : "text-muted"}>{label}</dt>
              <dd className="tabular-nums">{formatMoney(value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {i.status === "Draft" && (
          <Link href={`/invoices/${i.id}/edit`} className="inline-flex h-10 items-center rounded-sm border border-rule bg-panel px-4 text-sm font-medium text-ink hover:border-ink">
            Edit
          </Link>
        )}
        {(next === "Sent" || next === "Paid") && <Advance id={i.id} to={next} />}
        {i.status === "Draft" && <DeleteInvoice id={i.id} name={number} />}
      </div>
      {i.status !== "Draft" && (
        <p className="mt-4 text-sm text-muted">
          {i.status === "Paid" ? "Paid in full." : "Sent to the client, so it can no longer be changed or deleted."}
        </p>
      )}
    </main>
  );
}
