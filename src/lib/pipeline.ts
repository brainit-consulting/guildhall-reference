// The pipeline board's columns (B10). No database imports, so the board can regroup its cards in the browser the
// moment one moves.
import { DEAL_STAGES, type DealStage } from "@/lib/deal-stages";
import { addMoney } from "@/lib/money";

export type Column<T> = { stage: DealStage; deals: T[]; count: number; total: string };

// Every stage gets a column, in order, even when empty; deals keep the order they came in.
export function pipelineColumns<T extends { stage: DealStage; value: string | null }>(deals: readonly T[]): Column<T>[] {
  return DEAL_STAGES.map((stage) => {
    const inStage = deals.filter((d) => d.stage === stage);
    return { stage, deals: inStage, count: inStage.length, total: addMoney(inStage.map((d) => d.value)) };
  });
}
