import type { Metadata } from "next";
import { BUSINESS_NAME } from "@/lib/brand";
import { EnquiryForm } from "./enquiry-form";

// The page the owner links from their website. Public: outside the (signed-in) group, no session, no menu and nothing
// from the records, so signed-in people see the same form as anyone else.
export const metadata: Metadata = { title: "Ask for a quote" };

export default function EnquirePage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-12 md:py-20">
      <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6 wrap-anywhere">{BUSINESS_NAME}</h1>
      <p className="mt-3 border-t border-rule pt-3 text-ink">Ask for a quote. We&apos;ll get back to you.</p>
      <EnquiryForm />
    </main>
  );
}
