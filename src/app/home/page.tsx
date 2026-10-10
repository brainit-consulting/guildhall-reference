import type { Metadata } from "next";
import { SignOutButton } from "@/components/sign-out-button";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Home · Guildhall" };

export default async function Home() {
  const { user } = await requireSession();
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
      <h1 className="font-display text-4xl text-ink md:-ml-6">Welcome, {user.name}.</h1>
      <div className="mt-4 flex flex-col items-start gap-4 border-t border-rule pt-4">
        <p className="text-muted">Your records will live here as Guildhall grows.</p>
        <SignOutButton />
      </div>
    </main>
  );
}
