import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { listAllowedEmails } from "@/lib/access";
import { requireOwner } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { enquiryFormUrl } from "@/lib/enquiry-form";
import { env } from "@/lib/env";
import { getBusinessAddress, getTaxRate } from "@/lib/settings";
import { removeAllowedEmailAction } from "./actions";
import { AddressForm } from "./address-form";
import { AllowedEmailForm } from "./allowed-email-form";
import { CopyAddress } from "./copy-address";
import { ResetDemoData } from "./reset-demo-data";
import { TaxRateForm } from "./tax-rate-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireOwner();
  const [allowed, taxRate, address] = await Promise.all([listAllowedEmails(db), getTaxRate(db), getBusinessAddress(db)]);
  return (
    <main className="max-w-2xl px-6 py-12 md:px-12">
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

      <section aria-labelledby="enquiry-heading" className="mt-12 border-t border-rule pt-6">
        <h2 id="enquiry-heading" className="font-display text-2xl text-ink">Your enquiry form</h2>
        <p className="mt-2 text-muted">Put this link on your website. Anyone can use it to ask you for a quote, without an account.</p>
        <CopyAddress url={enquiryFormUrl(env.authUrl)} />
      </section>

      <section aria-labelledby="invoices-heading" className="mt-12 border-t border-rule pt-6">
        <h2 id="invoices-heading" className="font-display text-2xl text-ink">Invoices</h2>
        <p className="mt-2 text-muted">The tax you charge, as a percentage of each invoice&apos;s subtotal. Enter 0 if you don&apos;t charge tax.</p>
        <div className="mt-6">
          <TaxRateForm current={taxRate} />
        </div>
        <div className="mt-8">
          <AddressForm current={address} />
        </div>
      </section>

      <section aria-labelledby="agents-heading" className="mt-12 border-t border-rule pt-6">
        <h2 id="agents-heading" className="font-display text-2xl text-ink">Agents</h2>
        <p className="mt-2 text-muted">See which agents can reach your Guildhall and disconnect one, or see everything an agent you connected has changed, and when.</p>
        <div className="mt-4 flex flex-wrap gap-x-6">
          <Link href="/settings/connections" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">
            Connected agents
          </Link>
          <Link href="/settings/agent-log" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">
            Open the agent log
          </Link>
        </div>
      </section>

      {/* only on the live showcase, where students share the demo account */}
      {env.demoEmail && (
        <section aria-labelledby="demo-data-heading" className="mt-12 border-t border-rule pt-6">
          <h2 id="demo-data-heading" className="font-display text-2xl text-ink">Demo data</h2>
          <p className="mt-2 text-muted">Put the Hollow Oak companies, contacts and deals back the way they started, dated from today. Accounts and the emails above stay.</p>
          <ResetDemoData />
        </section>
      )}
    </main>
  );
}
