import type { DealStage } from "@/lib/deal-stages";

// Stages in the ledger's three inks (DESIGN.md: no rainbow): open ones in ink, Won in the accent, Lost muted.
export function StageName({ stage }: { stage: DealStage }) {
  const ink = stage === "Won" ? "text-accent font-medium" : stage === "Lost" ? "text-muted" : "text-ink";
  return <span className={ink}>{stage}</span>;
}
