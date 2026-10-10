import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { listAllowedEmails } from "@/lib/access";
import { requireOwner } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { removeAllowedEmailAction } from "./actions";
import { AllowedEmailForm } from "./allowed-email-form";

export const metadata: Metadata = { title: "Settings · Guildhall" };

export default async function SettingsPage() {
  await requireOwner();
  const allowed = await listAllowedEmails(db);
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Settings</h1>

      <section aria-labelledby="sign-up-heading" className="mt-8 border-t border-rule pt-6">
        <h2 id="sign-up-heading" className="font-display text-2xl text-ink">People who may sign up</h2>
        <p className="mt-2 text-muted">Only you and the emails below can create an account.</p>
        <div className="mt-6">
          <AllowedEmailForm />
        </div>

        {allowed.length === 0 ? (
          <p className="mt-8 text-muted">No one else yet. Add an email above to let them sign up.</p>
        ) : (
          <table className="mt-8 w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-rule bg-panel text-sm text-muted">
                <th scope="col" className="px-3 py-2 font-medium">Email</th>
                <th scope="col" className="px-3 py-2"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {allowed.map((a) => (
                <tr key={a.id} className="border-b border-rule">
                  <td className="break-all px-3 py-2 text-ink">{a.email}</td>
                  <td className="px-3 py-2 text-right">
                    <form action={removeAllowedEmailAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <Button type="submit" variant="danger" size="sm" aria-label={`Remove ${a.email}`}>Remove</Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
