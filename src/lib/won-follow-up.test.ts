import { describe, expect, it } from "vitest";
import { wonFollowUpDue } from "./won-follow-up";

describe("wonFollowUpDue", () => {
  it("is a week after the won day", () => {
    expect(wonFollowUpDue("2026-10-11")).toBe("2026-10-18");
  });

  it("crosses months, years and the clocks going back", () => {
    expect(wonFollowUpDue("2026-10-31")).toBe("2026-11-07");
    expect(wonFollowUpDue("2026-12-28")).toBe("2027-01-04");
  });
});
