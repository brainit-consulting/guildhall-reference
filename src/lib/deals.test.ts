import { describe, expect, it } from "vitest";
import { checkDeal, DEAL_STAGES, EMPTY_DEAL, isOpen, stageChangeText } from "./deals";

const ID = "6f1c2a4e-3b5d-4e7f-8a9b-0c1d2e3f4a5b";

describe("the stages", () => {
  it("are fixed, in order, and the first three are open", () => {
    expect(DEAL_STAGES).toEqual(["New", "Contacted", "Proposal", "Won", "Lost"]);
    expect(DEAL_STAGES.filter(isOpen)).toEqual(["New", "Contacted", "Proposal"]);
  });
});

describe("checkDeal", () => {
  it("trims, stores money exactly and turns blanks into null", () => {
    expect(checkDeal({ ...EMPTY_DEAL, title: "  Re-roof the hall ", value: "12,500.5", contactId: ID, expectedClose: "2026-11-30" })).toEqual({
      values: { title: "Re-roof the hall", value: "12500.50", stage: "New", contactId: ID, companyId: null, expectedClose: "2026-11-30" },
      errors: null,
    });
    expect(checkDeal({ ...EMPTY_DEAL, title: "Gutters", value: " " }).values).toMatchObject({ value: null, expectedClose: null });
  });

  it("needs a title", () => {
    expect(checkDeal({ ...EMPTY_DEAL, title: " " }).errors).toEqual({ title: "Enter a title." });
  });

  it("explains a value it can't store", () => {
    expect(checkDeal({ ...EMPTY_DEAL, title: "Gutters", value: "12.345" }).errors).toEqual({ value: "Enter at most two decimals, like 1250.50." });
  });

  it("only takes the five stages", () => {
    expect(checkDeal({ ...EMPTY_DEAL, title: "Gutters", stage: "Won" }).values?.stage).toBe("Won");
    expect(checkDeal({ ...EMPTY_DEAL, title: "Gutters", stage: "won" }).errors).toHaveProperty("stage");
    expect(checkDeal({ ...EMPTY_DEAL, title: "Gutters", stage: "" }).errors).toHaveProperty("stage");
  });

  it("refuses a date that isn't on the calendar, and ids that can't be records", () => {
    expect(checkDeal({ ...EMPTY_DEAL, title: "Gutters", expectedClose: "2026-02-30" }).errors)
      .toEqual({ expectedClose: "Enter a date, like 12 Oct 2026." });
    expect(checkDeal({ ...EMPTY_DEAL, title: "Gutters", contactId: "7", companyId: "x" }).errors)
      .toEqual({ contactId: expect.any(String), companyId: expect.any(String) });
  });
});

describe("stageChangeText", () => {
  it("says where the deal came from and went", () => {
    expect(stageChangeText("Contacted", "Proposal")).toBe("Moved from Contacted to Proposal");
  });
});
