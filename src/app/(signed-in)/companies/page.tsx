import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { COMPANY_SORTS, listCompanies, type Company } from "@/lib/companies";
import { db } from "@/lib/db/client";
import { listHref, readListView, type SearchParams } from "@/lib/list-view";
import { SearchBox } from "../_lists/search-box";
import { SortBy } from "../_lists/sort-by";
import { SortHeading } from "../_lists/sort-heading";

export const metadata: Metadata = { title: "Companies · Guildhall" };

const PATH = "/companies";
const COLUMNS = [{ key: "name", label: "Name" }, { key: "website", label: "Website" }, { key: "phone", label: "Phone" }];

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireSession();
  const params = await searchParams;
  const view = readListView(params, COMPANY_SORTS);
  const companies = await listCompanies(db, view);
  const list = { path: PATH, params, view };
  return (
    <main className="max-w-4xl px-6 py-12 md:px-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Companies</h1>
        <Link href="/companies/new" className="inline-flex h-10 items-center rounded-sm bg-accent px-4 text-sm font-medium text-paper hover:opacity-90">
          Add company
        </Link>
      </div>

      {/* Kept outside the empty states, so the box keeps its focus and what is typed while the list changes. */}
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div className="w-full max-w-sm"><SearchBox path={PATH} params={params} q={view.q} /></div>
        <SortBy {...list} columns={COLUMNS} defaultLabel="Newest added first" className="w-full md:hidden" />
      </div>

      {companies.length === 0 && view.q ? (
        <p className="mt-8 border-t border-rule pt-6 text-muted wrap-anywhere">
          No matches for &quot;{view.q}&quot;.{" "}
          <Link href={listHref(PATH, params, { q: null })} className="text-accent underline-offset-4 hover:underline">Clear search</Link>
        </p>
      ) : companies.length === 0 ? (
        <p className="mt-8 border-t border-rule pt-6 text-muted">
          No companies yet. <Link href="/companies/new" className="text-accent underline-offset-4 hover:underline">Add your first.</Link>
        </p>
      ) : (
        <>
          {/* Under 768px each company is a stacked block: the name as the link, then "Label: value" lines (DESIGN.md).
              wrap-anywhere lets a long website break wherever it must rather than push the page sideways. */}
          <ul aria-label="Companies" className="mt-8 border-t border-rule md:hidden">
            {companies.map((c) => (
              <li key={c.id} className="border-b border-rule py-3">
                <Link href={`/companies/${c.id}`} className="text-accent underline-offset-4 wrap-anywhere hover:underline">{c.name}</Link>
                {details(c).map(([label, value]) => (
                  <p key={label} className="mt-1 text-sm text-ink wrap-anywhere">
                    <span className="text-muted">{label}:</span> {value}
                  </p>
                ))}
              </li>
            ))}
          </ul>

          <div className="mt-8 hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-rule bg-panel text-sm text-muted">
                  {COLUMNS.map((c) => <SortHeading key={c.key} {...list} column={c.key} label={c.label} />)}
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-b border-rule">
                    <td className="px-3 py-2">
                      <Link href={`/companies/${c.id}`} className="text-accent underline-offset-4 hover:underline">{c.name}</Link>
                    </td>
                    <td className="px-3 py-2 text-ink wrap-anywhere">{c.website}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink">{c.phone}</td>
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

// The table's other columns, for the stacked rows; blank ones are left out to keep each block short.
function details(c: Company): [string, string][] {
  const lines: [string, string | null][] = [["Website", c.website], ["Phone", c.phone]];
  return lines.filter((l): l is [string, string] => !!l[1]);
}
