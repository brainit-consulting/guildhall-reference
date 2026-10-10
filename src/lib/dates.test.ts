import { describe, expect, it } from "vitest";
import { formatDay } from "./dates";

describe("formatDay", () => {
  it("shows a calendar day as 12 Oct 2026", () => {
    expect(formatDay("2026-10-12")).toBe("12 Oct 2026");
    expect(formatDay("2027-01-01")).toBe("1 Jan 2027");
    expect(formatDay("2026-12-31")).toBe("31 Dec 2026");
    expect(formatDay("2026-09-05")).toBe("5 Sep 2026");
  });
});
