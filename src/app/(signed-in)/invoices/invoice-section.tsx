import Link from "next/link";
import { formatDay, TIME_ZONE, todayIn } from "@/lib/dates";
import { formatInvoiceNumber, isOverdue, type InvoiceRow } from "@/lib/invoices";
import { formatMoney } from "@/lib/money";
import { StatusText } from "./status-text";

const link = "text-accent underline-offset-4 hover:underline";

// The Invoices section on a client's or project's page: "New invoice" with that record picked, and its invoices.
export function InvoiceSection({ invoices, newHref, empty }: { invoices: InvoiceRow[]; newHref: string; empty: string }) {
  const today = todayIn(TIME_ZONE, new Date());
  return (
    <section aria-labelledby="invoices" className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 id="invoices" className="font-display text-2xl text-ink">Invoices</h2>
        <Link href={newHref} className="inline-flex h-10 items-center rounded-sm bg-accent px-4 text-sm font-medium text-paper hover:opacity-90">
          New invoice
        </Link>
      </div>
      {invoices.length === 0 ? (
        <p className="mt-4 border-t border-rule pt-4 text-muted">{empty}</p>
      ) : (
        <ul aria-label="Invoices" className="mt-4 border-t border-rule">
          {invoices.map((i) => (
            <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule py-3">
              <Link href={`/invoices/${i.id}`} className={`tap-target ${link}`}>{formatInvoiceNumber(i.number)}</Link>
              <span className="text-sm text-muted">
                <StatusText status={i.status} overdue={isOverdue(i, today)} /> · due {formatDay(i.dueOn)}
                <span className="ml-3 tabular-nums text-ink">{formatMoney(i.totals.total)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
