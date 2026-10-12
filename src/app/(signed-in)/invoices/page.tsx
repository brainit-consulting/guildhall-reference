import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { formatDay, TIME_ZONE, todayIn } from "@/lib/dates";
import { db } from "@/lib/db/client";
import { formatInvoiceNumber, isOverdue, listInvoices } from "@/lib/invoices";
import { formatMoney } from "@/lib/money";
import { StatusText } from "./status-text";

export const metadata: Metadata = { title: "Invoices" };

const link = "tap-target text-accent underline-offset-4 hover:underline";

export default async function InvoicesPage() {
  await requireSession();
  const invoices = await listInvoices(db);
  const today = todayIn(TIME_ZONE, new Date());
  return (
    <main className="max-w-5xl px-6 py-12 md:px-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-3">
        <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Invoices</h1>
        <Link href="/invoices/new" className="inline-flex h-10 items-center rounded-sm bg-accent px-4 text-sm font-medium text-paper hover:opacity-90">
          New invoice
        </Link>
      </div>

      {invoices.length === 0 ? (
        <p className="mt-8 border-t border-rule pt-6 text-muted">No invoices yet. Press New invoice to bill a client.</p>
      ) : (
        <>
          {/* Under 768px each invoice is a stacked block: the number as the link, then "Label: value" lines (DESIGN.md). */}
          <ul aria-label="Invoices" className="mt-8 border-t border-rule md:hidden">
            {invoices.map((i) => (
              <li key={i.id} className="border-b border-rule py-3">
                <Link href={`/invoices/${i.id}`} className={link}>{formatInvoiceNumber(i.number)}</Link>
                <p className="mt-1 text-sm text-ink wrap-anywhere"><span className="text-muted">Client:</span> {i.clientName}</p>
                <p className="mt-1 text-sm text-ink"><span className="text-muted">Total:</span> <span className="tabular-nums">{formatMoney(i.totals.total)}</span></p>
                <p className="mt-1 text-sm"><span className="text-muted">Status:</span> <StatusText status={i.status} overdue={isOverdue(i, today)} /></p>
                <p className="mt-1 text-sm text-ink"><span className="text-muted">Due:</span> {formatDay(i.dueOn)}</p>
              </li>
            ))}
          </ul>

          <div className="mt-8 hidden overflow-x-auto md:block">
            <table aria-label="Invoices" className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-rule bg-panel text-sm text-muted">
                  <th scope="col" className="px-3 py-2 font-medium">Number</th>
                  <th scope="col" className="px-3 py-2 font-medium">Client</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Total</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 font-medium">Due</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-b border-rule">
                    <td className="px-3 py-2 whitespace-nowrap"><Link href={`/invoices/${i.id}`} className={link}>{formatInvoiceNumber(i.number)}</Link></td>
                    <td className="px-3 py-2 wrap-anywhere"><Link href={`/clients/${i.clientId}`} className={link}>{i.clientName}</Link></td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">{formatMoney(i.totals.total)}</td>
                    <td className="px-3 py-2"><StatusText status={i.status} overdue={isOverdue(i, today)} /></td>
                    <td className="px-3 py-2 whitespace-nowrap text-ink">{formatDay(i.dueOn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
