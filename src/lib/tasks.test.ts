import { describe, expect, it } from "vitest";
import { checkTask } from "./tasks";

describe("checkTask", () => {
  it("trims the title and keeps the day", () => {
    expect(checkTask({ title: "  Call Ann back ", dueOn: "2026-10-12" }))
      .toEqual({ values: { title: "Call Ann back", dueOn: "2026-10-12" }, errors: null });
  });

  it("allows a day in the past: a promise made yesterday still counts", () => {
    expect(checkTask({ title: "Send the quote", dueOn: "2020-01-01" }).errors).toBeNull();
  });

  it("asks for a title", () => {
    expect(checkTask({ title: "   ", dueOn: "2026-10-12" })).toEqual({ values: null, errors: { title: "Write what you promised." } });
  });

  it("asks for a real calendar day", () => {
    for (const dueOn of ["", "  ", "2026-02-30", "2026-13-01", "12 Oct 2026", "2026-10-1"]) {
      expect(checkTask({ title: "Book a visit", dueOn }).errors).toEqual({ dueOn: "Pick a due date." });
    }
  });

  it("explains both at once", () => {
    expect(checkTask({ title: "", dueOn: "" }).errors).toEqual({ title: "Write what you promised.", dueOn: "Pick a due date." });
  });
});
