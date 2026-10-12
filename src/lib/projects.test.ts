import { describe, expect, it } from "vitest";
import { checkProject, ENDS_BEFORE_START, EMPTY_PROJECT, PICK_CLIENT } from "./projects";

const CLIENT = "6f1c2a3e-1d2b-4c5d-8e9f-0a1b2c3d4e5f";
const typed = { name: " Oak staircase ", clientId: CLIENT, budget: "$ 4,500", startOn: "2026-10-12", endOn: "2026-11-20" };

describe("checkProject", () => {
  it("trims the name and stores the budget as exact money", () => {
    expect(checkProject(typed)).toEqual({
      values: { name: "Oak staircase", clientId: CLIENT, budget: "4500.00", startOn: "2026-10-12", endOn: "2026-11-20" },
      errors: null,
    });
  });

  it("refuses an end before the start", () => {
    expect(checkProject({ ...typed, endOn: "2026-10-11" }).errors).toEqual({ endOn: ENDS_BEFORE_START });
  });

  it("allows a project that starts and ends on one day", () => {
    expect(checkProject({ ...typed, endOn: "2026-10-12" }).errors).toBeNull();
  });

  it("asks for every field when nothing is typed", () => {
    expect(checkProject(EMPTY_PROJECT).errors).toEqual({
      name: "Enter a name.", clientId: PICK_CLIENT, budget: "Enter a budget, like 4500.00.",
      startOn: "Enter the start date.", endOn: "Enter the end date.",
    });
  });

  it("refuses a day that doesn't exist, a negative budget and a client id that isn't one", () => {
    expect(checkProject({ ...typed, startOn: "2026-02-30", budget: "-5", clientId: "1" }).errors).toEqual({
      startOn: "Enter a date, like 12 Oct 2026.", budget: "Enter an amount of 0 or more.", clientId: PICK_CLIENT,
    });
  });

  it("allows a budget of 0", () => {
    expect(checkProject({ ...typed, budget: "0" }).values?.budget).toBe("0.00");
  });
});
