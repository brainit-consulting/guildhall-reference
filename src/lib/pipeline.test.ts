import { describe, expect, it } from "vitest";
import type { DealStage } from "./deal-stages";
import { pipelineColumns } from "./pipeline";

const d = (title: string, stage: DealStage, value: string | null) => ({ title, stage, value });

describe("pipelineColumns", () => {
  it("gives all five stages in order, empty ones too", () => {
    const columns = pipelineColumns([]);
    expect(columns.map((c) => c.stage)).toEqual(["New", "Contacted", "Proposal", "Won", "Lost"]);
    expect(columns.every((c) => c.count === 0 && c.total === "0.00" && c.deals.length === 0)).toBe(true);
  });

  it("puts each deal in its stage, keeps their order, and counts and totals each column exactly", () => {
    const columns = pipelineColumns([
      d("Gutters", "New", "0.10"), d("Porch", "Won", "500.00"), d("Roof", "New", "0.20"), d("Fence", "New", null),
    ]);
    const byStage = Object.fromEntries(columns.map((c) => [c.stage, c]));
    expect(byStage.New.deals.map((x) => x.title)).toEqual(["Gutters", "Roof", "Fence"]);
    expect(byStage.New).toMatchObject({ count: 3, total: "0.30" }); // not 0.30000000000000004
    expect(byStage.Won).toMatchObject({ count: 1, total: "500.00" });
    expect(byStage.Lost).toMatchObject({ count: 0, total: "0.00" });
  });
});
