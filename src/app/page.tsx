import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function WelcomePage() {
  if (await getSession()) redirect("/home");
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6">
      <h1 className="font-display text-5xl text-ink md:-ml-6">Guildhall</h1>
      <div className="mt-4 border-t border-rule pt-4">
        <p className="text-lg text-ink">A CRM for your business, built by your guild.</p>
        <p className="mt-2 text-muted">Nothing here yet: your coders build it, chapter by chapter.</p>
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
