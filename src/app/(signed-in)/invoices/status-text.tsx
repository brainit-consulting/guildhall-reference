import type { InvoiceStatus } from "@/lib/db/schema";

// The status in words. An overdue Sent invoice is marked in the accent (DESIGN.md: one accent, no rainbow); Paid reads
// muted, with nothing more to do.
export function StatusText({ status, overdue }: { status: InvoiceStatus; overdue: boolean }) {
  if (overdue) return <span className="font-medium text-accent">Sent, overdue</span>;
  return <span className={status === "Paid" ? "text-muted" : "text-ink"}>{status}</span>;
}
