import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";
import { db } from "@/lib/db/client";
import { getDeal } from "@/lib/deals";
import { formatMoney } from "@/lib/money";
import { StageName } from "../stage-name";
import { DeleteDeal } from "./delete-deal";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  await requireSession(); // the title holds the deal's name, so it is guarded like the page
  const d = await getDeal(db, (await params).id);
  return { title: `${d?.title ?? "Deal"} · Guildhall` };
}

const link = "text-accent underline-offset-4 hover:underline";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const d = await getDeal(db, id);
  if (!d) notFound();

  // [label, value, what a blank one says]
  const fields: [string, React.ReactNode, string?][] = [
    ["Value", d.value && <span className="tabular-nums">{formatMoney(d.value)}</span>],
    ["Stage", <StageName key="stage" stage={d.stage} />],
    ["Contact", d.contactId ? <Link href={`/contacts/${d.contactId}`} className={link}>{d.contactName}</Link> : null, "No contact"],
    ["Company", d.companyId ? <Link href={`/companies/${d.companyId}`} className={link}>{d.companyName}</Link> : null, "No company"],
    ["Expected close", d.expectedClose && formatDay(d.expectedClose)],
  ];

  return (
    <main className="max-w-2xl px-6 py-12 md:px-12">
      <Link href="/deals" className={`text-sm ${link}`}>Deals</Link>
      <h1 className="mt-2 font-display text-4xl text-ink -ml-px md:-ml-6 wrap-anywhere">{d.title}</h1>

      <dl className="mt-8 border-t border-rule">
        {fields.map(([label, value, blank]) => (
          <div key={label} className="grid gap-1 border-b border-rule py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className={value ? "break-words text-ink" : "text-muted"}>{value || blank || "Not given"}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex items-center gap-3">
        <Link href={`/deals/${d.id}/edit`} className="inline-flex h-10 items-center rounded-sm border border-rule bg-panel px-4 text-sm font-medium text-ink hover:border-ink">
          Edit
        </Link>
        <DeleteDeal id={d.id} name={d.title} />
      </div>
    </main>
  );
}
