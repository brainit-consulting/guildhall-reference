// The fixed deal stages, in order (spec B9). Kept apart from deals.ts, with no imports, so the browser-side form can
// list them without bundling the database code. A new deal starts at the first.
export const DEAL_STAGES = ["New", "Contacted", "Proposal", "Won", "Lost"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

// "Open" means not yet won or lost.
export const OPEN_STAGES: readonly DealStage[] = ["New", "Contacted", "Proposal"];

export function isOpen(stage: DealStage): boolean {
  return OPEN_STAGES.includes(stage);
}
