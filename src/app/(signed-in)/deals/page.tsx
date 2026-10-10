import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";
import { db } from "@/lib/db/client";
import { listDeals, openDealsTotal, type DealWithNames } from "@/lib/deals";
import { formatMoney } from "@/lib/money";
import { StageName } from "./stage-name";

export const metadata: Metadata = { title: "Deals · Guildhall" };

export default async function DealsPage() {
  await requireSession();
  const [deals, open] = await Promise.all([listDeals(db), openDealsTotal(db)]);
  return (
    <main className="max-w-5xl px-6 py-12 md:px-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Deals</h1>
        <Link href="/deals/new" className="inline-flex h-10 items-center rounded-sm bg-accent px-4 text-sm font-medium text-paper hover:opacity-90">
          Add deal
        </Link>
      </div>

      {/* The ledger's running figure: open means New, Contacted or Proposal. */}
      <dl aria-label="Open deals" className="mt-8 flex flex-wrap gap-x-10 gap-y-2 border-y border-rule py-4">
        <div>
          <dt className="text-sm text-muted">Open deals</dt>
          <dd className="font-display text-2xl tabular-nums text-ink">{open.count}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Open value</dt>
          <dd className="font-display text-2xl tabular-nums text-ink">{formatMoney(open.total)}</dd>
        </div>
      </dl>

      {deals.length === 0 ? (
        <p className="mt-6 text-muted">
          No deals yet. <Link href="/deals/new" className="text-accent underline-offset-4 hover:underline">Add your first.</Link>
        </p>
      ) : (
        <>
          {/* Under 768px each deal is a stacked block: the title as the link, then "Label: value" lines (DESIGN.md). */}
          <ul aria-label="Deals" className="mt-6 border-t border-rule md:hidden">
            {deals.map((d) => (
              <li key={d.id} className="border-b border-rule py-3">
                <Link href={`/deals/${d.id}`} className="text-accent underline-offset-4 wrap-anywhere hover:underline">{d.title}</Link>
                {d.companyId && (
                  <p className="mt-1 text-sm text-ink wrap-anywhere">
                    <span className="text-muted">Company:</span> <CompanyLink d={d} />
                  </p>
                )}
                {d.value && (
                  <p className="mt-1 text-sm text-ink"><span className="text-muted">Value:</span> <span className="tabular-nums">{formatMoney(d.value)}</span></p>
                )}
                <p className="mt-1 text-sm"><span className="text-muted">Stage:</span> <StageName stage={d.stage} /></p>
                {d.expectedClose && (
                  <p className="mt-1 text-sm text-ink"><span className="text-muted">Expected close:</span> {formatDay(d.expectedClose)}</p>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-6 hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-rule bg-panel text-sm text-muted">
                  <th scope="col" className="px-3 py-2 font-medium">Title</th>
                  <th scope="col" className="px-3 py-2 font-medium">Company</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Value</th>
                  <th scope="col" className="px-3 py-2 font-medium">Stage</th>
                  <th scope="col" className="px-3 py-2 font-medium">Expected close</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id} className="border-b border-rule">
                    <td className="px-3 py-2">
                      <Link href={`/deals/${d.id}`} className="text-accent underline-offset-4 hover:underline">{d.title}</Link>
                    </td>
                    <td className="px-3 py-2">{d.companyId && <CompanyLink d={d} />}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink">{d.value && formatMoney(d.value)}</td>
                    <td className="px-3 py-2"><StageName stage={d.stage} /></td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink">{d.expectedClose && formatDay(d.expectedClose)}</td>
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

function CompanyLink({ d }: { d: DealWithNames }) {
  return <Link href={`/companies/${d.companyId}`} className="text-accent underline-offset-4 hover:underline">{d.companyName}</Link>;
}
