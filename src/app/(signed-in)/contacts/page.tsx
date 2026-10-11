import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { CONTACT_SORTS, listContacts, type ContactWithCompany } from "@/lib/contacts";
import { db } from "@/lib/db/client";
import { listHref, readListView, type SearchParams } from "@/lib/list-view";
import { SearchBox } from "../_lists/search-box";
import { SortBy } from "../_lists/sort-by";
import { SortHeading } from "../_lists/sort-heading";

export const metadata: Metadata = { title: "Contacts · Guildhall" };

const PATH = "/contacts";
const COLUMNS = [
  { key: "name", label: "Name" }, { key: "company", label: "Company" }, { key: "email", label: "Email" },
  { key: "phone", label: "Phone" }, { key: "title", label: "Job title" },
];

export default async function ContactsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireSession();
  const params = await searchParams;
  const view = readListView(params, CONTACT_SORTS);
  const contacts = await listContacts(db, view);
  const list = { path: PATH, params, view };
  return (
    <main className="max-w-4xl px-6 py-12 md:px-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Contacts</h1>
        <Link href="/contacts/new" className="inline-flex h-10 items-center rounded-sm bg-accent px-4 text-sm font-medium text-paper hover:opacity-90">
          Add contact
        </Link>
      </div>

      {/* Kept outside the empty states, so the box keeps its focus and what is typed while the list changes. */}
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div className="w-full max-w-sm"><SearchBox path={PATH} params={params} q={view.q} /></div>
        <SortBy {...list} columns={COLUMNS} defaultLabel="Newest added first" className="w-full md:hidden" />
      </div>

      {contacts.length === 0 && view.q ? (
        <p className="mt-8 border-t border-rule pt-6 text-muted wrap-anywhere">
          No matches for &quot;{view.q}&quot;.{" "}
          <Link href={listHref(PATH, params, { q: null })} className="text-accent underline-offset-4 hover:underline">Clear search</Link>
        </p>
      ) : contacts.length === 0 ? (
        <p className="mt-8 border-t border-rule pt-6 text-muted">
          No contacts yet. <Link href="/contacts/new" className="text-accent underline-offset-4 hover:underline">Add your first.</Link>
        </p>
      ) : (
        <>
          {/* Under 768px each contact is a stacked block: the name as the link, then "Label: value" lines (DESIGN.md).
              wrap-anywhere lets a long email break wherever it must rather than push the page sideways. */}
          <ul aria-label="Contacts" className="mt-8 border-t border-rule md:hidden">
            {contacts.map((c) => (
              <li key={c.id} className="border-b border-rule py-3">
                <Link href={`/contacts/${c.id}`} className="text-accent underline-offset-4 wrap-anywhere hover:underline">{c.name}</Link>
                {c.companyId && (
                  <p className="mt-1 text-sm text-ink wrap-anywhere">
                    <span className="text-muted">Company:</span> <CompanyLink c={c} />
                  </p>
                )}
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
                {contacts.map((c) => (
                  <tr key={c.id} className="border-b border-rule">
                    <td className="px-3 py-2">
                      <Link href={`/contacts/${c.id}`} className="text-accent underline-offset-4 hover:underline">{c.name}</Link>
                    </td>
                    <td className="px-3 py-2">{c.companyId && <CompanyLink c={c} />}</td>
                    <td className="px-3 py-2 text-ink wrap-anywhere">{c.email}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink">{c.phone}</td>
                    <td className="px-3 py-2 text-ink">{c.jobTitle}</td>
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

function CompanyLink({ c }: { c: ContactWithCompany }) {
  return <Link href={`/companies/${c.companyId}`} className="text-accent underline-offset-4 hover:underline">{c.companyName}</Link>;
}

// The table's other columns, for the stacked rows; blank ones are left out to keep each block short.
function details(c: ContactWithCompany): [string, string][] {
  const lines: [string, string | null][] = [["Email", c.email], ["Phone", c.phone], ["Job title", c.jobTitle]];
  return lines.filter((l): l is [string, string] => !!l[1]);
}
