import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-mark";
import { getSession } from "@/lib/auth/session";
import { BUSINESS_NAME } from "@/lib/brand";

export default async function WelcomePage() {
  if (await getSession()) redirect("/home");
  return (
    <main className="mx-auto flex w-full flex-1 max-w-2xl flex-col justify-center px-6">
      {/* decorative: the heading under it says the same words */}
      <BrandLogo size={64} alt="" className="md:-ml-6" />
      <h1 className="mt-6 font-display text-5xl break-words text-ink -ml-px md:-ml-6">{BUSINESS_NAME}</h1>
      <div className="mt-4 border-t border-rule pt-4">
        <p className="text-lg text-ink">Customers, deals and tasks for {BUSINESS_NAME}.</p>
        <div className="mt-6 flex items-center gap-4">
          <Link
            href="/signin"
            className="inline-flex h-10 items-center rounded-sm bg-accent px-4 text-sm font-medium text-paper hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Sign in
          </Link>
          <Link href="/signup" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
