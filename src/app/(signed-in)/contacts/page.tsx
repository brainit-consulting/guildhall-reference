import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listContacts } from "@/lib/contacts";
import { db } from "@/lib/db/client";

export const metadata: Metadata = { title: "Contacts · Guildhall" };

export default async function ContactsPage() {
  await requireSession();
  const contacts = await listContacts(db);
  return (
    <main className="max-w-4xl px-6 py-12 md:px-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Contacts</h1>
        <Link href="/contacts/new" className="inline-flex h-10 items-center rounded-sm bg-accent px-4 text-sm font-medium text-paper hover:opacity-90">
          Add contact
        </Link>
      </div>

      {contacts.length === 0 ? (
        <p className="mt-8 border-t border-rule pt-6 text-muted">
          No contacts yet. <Link href="/contacts/new" className="text-accent underline-offset-4 hover:underline">Add your first.</Link>
        </p>
      ) : (
        // the table scrolls inside itself on a phone; the page never does
        <div className="mt-8 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-rule bg-panel text-sm text-muted">
                <th scope="col" className="px-3 py-2 font-medium">Name</th>
                <th scope="col" className="px-3 py-2 font-medium">Email</th>
                <th scope="col" className="px-3 py-2 font-medium">Phone</th>
                <th scope="col" className="px-3 py-2 font-medium">Job title</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-rule">
                  <td className="px-3 py-2">
                    <Link href={`/contacts/${c.id}`} className="text-accent underline-offset-4 hover:underline">{c.name}</Link>
                  </td>
                  <td className="break-all px-3 py-2 text-ink">{c.email}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink">{c.phone}</td>
                  <td className="px-3 py-2 text-ink">{c.jobTitle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
