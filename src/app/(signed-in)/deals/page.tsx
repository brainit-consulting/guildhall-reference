import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { formatDay, formatMonth } from "@/lib/dates";
import { db } from "@/lib/db/client";
import { listDeals, listedDealsTotal, openDealsTotal, readDealView, type DealWithNames } from "@/lib/deals";
import { listHref, type SearchParams } from "@/lib/list-view";
import { formatMoney } from "@/lib/money";
import { OpenOnly, StageFilter } from "./deal-filters";
import { StageName } from "./stage-name";
import { DaysAgo } from "../_activities/days-ago";
import { SearchBox } from "../_lists/search-box";
import { SortBy } from "../_lists/sort-by";
import { SortHeading } from "../_lists/sort-heading";

export const metadata: Metadata = { title: "Deals · Guildhall" };

const PATH = "/deals";
// The phone "Sort by" names each direction in words that suit the column; the headings use only the label.
const COLUMNS = [
  { key: "title", label: "Title" },
  { key: "company", label: "Company" },
  { key: "value", label: "Value", asc: "lowest first", desc: "highest first", className: "text-right" },
  { key: "stage", label: "Stage", asc: "New to Lost", desc: "Lost to New" },
  { key: "close", label: "Expected close", asc: "soonest first", desc: "latest first" },
  { key: "activity", label: "Last activity", asc: "longest ago first", desc: "most recent first" },
];

export default async function DealsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireSession();
  const params = await searchParams;
  const view = readDealView(params);
  // the same view for both, so the figures count only the deals the table shows: the open ones, or with `won` set,
  // every one listed (all at Won, so the open figures would read 0)
  const [deals, figures] = await Promise.all([
    listDeals(db, view), view.won ? listedDealsTotal(db, view) : openDealsTotal(db, view),
  ]);
  const [countLabel, valueLabel] = view.won ? ["Won deals", "Won value"] : ["Open deals", "Open value"];
  const now = new Date().toISOString();
  const list = { path: PATH, params, view };
  const filtered = view.stage !== null || view.open || view.won !== null;
  return (
    <main className="max-w-5xl px-6 py-12 md:px-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Deals</h1>
        <Link href="/deals/new" className="inline-flex h-10 items-center rounded-sm bg-accent px-4 text-sm font-medium text-paper hover:opacity-90">
          Add deal
        </Link>
      </div>

      {/* The ledger's running figure: open means New, Contacted or Proposal, among the deals listed below. */}
      <dl aria-label={countLabel} className="mt-8 flex flex-wrap gap-x-10 gap-y-2 border-y border-rule py-4">
        <div>
          <dt className="text-sm text-muted">{countLabel}</dt>
          <dd className="font-display text-2xl tabular-nums text-ink">{figures.count}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">{valueLabel}</dt>
          <dd className="font-display text-2xl tabular-nums text-ink">{formatMoney(figures.total)}</dd>
        </div>
      </dl>

      {/* Kept outside the empty states, so the box keeps its focus and what is typed while the list changes. */}
      <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="w-full max-w-sm"><SearchBox path={PATH} params={params} q={view.q} /></div>
        <StageFilter path={PATH} params={params} stage={view.stage} />
        <OpenOnly path={PATH} params={params} on={view.open} />
        <SortBy {...list} columns={COLUMNS} defaultLabel="Newest added first" className="w-full md:hidden" />
      </div>

      {/* Set only from the address (Home's "Won this month"), so it says so here and can be taken off. */}
      {view.won && (
        <p className="mt-6 text-ink">
          Won in {formatMonth(view.won)}.{" "}
          <Link href={listHref(PATH, params, { won: null })} className="text-accent underline-offset-4 hover:underline">
            Show every month
          </Link>
        </p>
      )}

      {deals.length === 0 && (view.q || filtered) ? (
        <p className="mt-6 border-t border-rule pt-6 text-muted wrap-anywhere">
          {view.q ? <>No deals match &quot;{view.q}&quot;{filtered && " with these filters"}.</> : "No deals match these filters."}{" "}
          <Link href={listHref(PATH, params, { q: null, stage: null, open: null, won: null })} className="text-accent underline-offset-4 hover:underline">
            {view.q && filtered ? "Clear search and filters" : view.q ? "Clear search" : "Clear filters"}
          </Link>
        </p>
      ) : deals.length === 0 ? (
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
                <p className="mt-1 text-sm text-ink"><span className="text-muted">Last activity:</span> <LastActivity d={d} now={now} /></p>
              </li>
            ))}
          </ul>

          <div className="mt-6 hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-rule bg-panel text-sm text-muted">
                  {COLUMNS.map((c) => <SortHeading key={c.key} {...list} column={c.key} label={c.label} className={c.className} />)}
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
                    <td className="whitespace-nowrap px-3 py-2 text-ink"><LastActivity d={d} now={now} /></td>
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

function LastActivity({ d, now }: { d: DealWithNames; now: string }) {
  return d.lastActivityAt ? <DaysAgo at={d.lastActivityAt.toISOString()} now={now} /> : <span className="text-muted">Nothing logged</span>;
}

function CompanyLink({ d }: { d: DealWithNames }) {
  return <Link href={`/companies/${d.companyId}`} className="text-accent underline-offset-4 hover:underline">{d.companyName}</Link>;
}
