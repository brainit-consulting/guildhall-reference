import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Home · Guildhall" };

export default async function Home() {
  const { user } = await requireSession();
  return (
    <main className="max-w-2xl px-6 py-12 md:px-12">
      <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Welcome, {user.name}.</h1>
      <div className="mt-4 border-t border-rule pt-4">
        <p className="text-muted">Your records will live here as Guildhall grows.</p>
      </div>
    </main>
  );
}
