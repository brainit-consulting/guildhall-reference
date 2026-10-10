import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getCompany, listCompanyContacts, websiteHref } from "@/lib/companies";
import { db } from "@/lib/db/client";
import { DeleteCompany } from "./delete-company";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  await requireSession(); // the title holds the name, so it is guarded like the page
  const c = await getCompany(db, (await params).id);
  return { title: `${c?.name ?? "Company"} · Guildhall` };
}

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const c = await getCompany(db, id);
  if (!c) notFound();
  const people = await listCompanyContacts(db, c.id);

  const href = websiteHref(c.website);
  const fields: [string, React.ReactNode][] = [
    ["Website", href
      ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-4 hover:underline">{c.website}</a>
      : c.website],
    ["Phone", c.phone],
    ["Notes", c.notes],
  ];

  return (
    <main className="max-w-2xl px-6 py-12 md:px-12">
      <Link href="/companies" className="text-sm text-accent underline-offset-4 hover:underline">Companies</Link>
      <h1 className="mt-2 font-display text-4xl text-ink -ml-px md:-ml-6">{c.name}</h1>

      <dl className="mt-8 border-t border-rule">
        {fields.map(([label, value]) => (
          <div key={label} className="grid gap-1 border-b border-rule py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className={value ? "whitespace-pre-line wrap-anywhere text-ink" : "text-muted"}>{value ?? "Not given"}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="people" className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 id="people" className="font-display text-2xl text-ink">Contacts</h2>
          <Link href={`/contacts/new?company=${c.id}`} className="text-sm text-accent underline-offset-4 hover:underline">Add contact</Link>
        </div>
        {people.length === 0 ? (
          <p className="mt-4 border-t border-rule pt-4 text-muted">
            No contacts here yet. Add one, or pick {c.name} as the company on a contact&apos;s form.
          </p>
        ) : (
          <ul aria-labelledby="people" className="mt-4 border-t border-rule">
            {people.map((p) => (
              <li key={p.id} className="border-b border-rule py-3">
                <Link href={`/contacts/${p.id}`} className="text-accent underline-offset-4 wrap-anywhere hover:underline">{p.name}</Link>
                {p.jobTitle && <span className="text-sm text-muted"> · {p.jobTitle}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 flex items-center gap-3">
        <Link href={`/companies/${c.id}/edit`} className="inline-flex h-10 items-center rounded-sm border border-rule bg-panel px-4 text-sm font-medium text-ink hover:border-ink">
          Edit
        </Link>
        <DeleteCompany id={c.id} name={c.name} contacts={people.length} />
      </div>
    </main>
  );
}
