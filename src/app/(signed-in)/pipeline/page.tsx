import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { listDeals } from "@/lib/deals";
import { Board, type Card } from "./board";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  await requireSession();
  // only what a card shows goes to the browser
  const cards: Card[] = (await listDeals(db)).map((d) => ({
    id: d.id, title: d.title, stage: d.stage, value: d.value, companyName: d.companyName,
  }));
  return (
    <main className="px-6 py-12 md:px-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Pipeline</h1>
        <Link href="/deals/new" className="inline-flex h-10 items-center rounded-sm bg-accent px-4 text-sm font-medium text-paper hover:opacity-90">
          Add deal
        </Link>
      </div>
      {cards.length === 0 && (
        <p className="mt-6 text-muted">
          No deals yet. <Link href="/deals/new" className="text-accent underline-offset-4 hover:underline">Add your first.</Link>
        </p>
      )}
      <Board cards={cards} />
    </main>
  );
}
