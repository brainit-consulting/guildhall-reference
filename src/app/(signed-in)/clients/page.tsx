import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listClients } from "@/lib/clients";
import { db } from "@/lib/db/client";

export const metadata: Metadata = { title: "Clients" };

const link = "tap-target text-accent underline-offset-4 hover:underline";

export default async function ClientsPage() {
  await requireSession();
  const clients = await listClients(db);
  return (
    <main className="max-w-4xl px-6 py-12 md:px-12">
      <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Clients</h1>

      {clients.length === 0 ? (
        <p className="mt-8 border-t border-rule pt-6 text-muted">
          No clients yet. Open a <Link href="/deals?stage=Won" className="text-accent underline-offset-4 hover:underline">Won deal</Link> and
          press Make client.
        </p>
      ) : (
        <>
          {/* Under 768px each client is a stacked block: the name as the link, then "Label: value" lines (DESIGN.md). */}
          <ul aria-label="Clients" className="mt-8 border-t border-rule md:hidden">
            {clients.map((c) => (
              <li key={c.id} className="border-b border-rule py-3">
                <Link href={`/clients/${c.id}`} className={`${link} wrap-anywhere`}>{c.name}</Link>
                {c.contactId && (
                  <p className="mt-1 text-sm text-ink wrap-anywhere"><span className="text-muted">Contact person:</span> {c.contactName}</p>
                )}
                <p className="mt-1 text-sm text-ink"><span className="text-muted">Won deals:</span> <span className="tabular-nums">{c.wonDeals}</span></p>
              </li>
            ))}
          </ul>

          <div className="mt-8 hidden overflow-x-auto md:block">
            <table aria-label="Clients" className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-rule bg-panel text-sm text-muted">
                  <th scope="col" className="px-3 py-2 font-medium">Name</th>
                  <th scope="col" className="px-3 py-2 font-medium">Contact person</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Won deals</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-b border-rule">
                    <td className="px-3 py-2 wrap-anywhere">
                      <Link href={`/clients/${c.id}`} className={link}>{c.name}</Link>
                    </td>
                    <td className="px-3 py-2 wrap-anywhere">
                      {c.contactId
                        ? <Link href={`/contacts/${c.contactId}`} className={link}>{c.contactName}</Link>
                        : <span className="text-muted">None</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">{c.wonDeals}</td>
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
