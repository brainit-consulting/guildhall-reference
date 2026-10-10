import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getCompany, websiteHref } from "@/lib/companies";
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

      <div className="mt-8 flex items-center gap-3">
        <Link href={`/companies/${c.id}/edit`} className="inline-flex h-10 items-center rounded-sm border border-rule bg-panel px-4 text-sm font-medium text-ink hover:border-ink">
          Edit
        </Link>
        <DeleteCompany id={c.id} name={c.name} />
      </div>
    </main>
  );
}
