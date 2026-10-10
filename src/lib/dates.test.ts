import { describe, expect, it } from "vitest";
import { daysAgo, formatDay } from "./dates";

describe("formatDay", () => {
  it("shows a calendar day as 12 Oct 2026", () => {
    expect(formatDay("2026-10-12")).toBe("12 Oct 2026");
    expect(formatDay("2027-01-01")).toBe("1 Jan 2027");
    expect(formatDay("2026-12-31")).toBe("31 Dec 2026");
    expect(formatDay("2026-09-05")).toBe("5 Sep 2026");
  });
});

describe("daysAgo", () => {
  it("counts calendar days, not hours", () => {
    expect(daysAgo("2026-10-12", "2026-10-12")).toBe("today");
    expect(daysAgo("2026-10-11", "2026-10-12")).toBe("yesterday");
    expect(daysAgo("2026-10-09", "2026-10-12")).toBe("3 days ago");
  });

  it("crosses months, years and clock changes", () => {
    expect(daysAgo("2026-09-28", "2026-10-02")).toBe("4 days ago");
    expect(daysAgo("2025-12-31", "2026-01-01")).toBe("yesterday");
    expect(daysAgo("2026-03-01", "2026-04-01")).toBe("31 days ago");
  });

  it("calls a day after today today", () => {
    expect(daysAgo("2026-10-13", "2026-10-12")).toBe("today");
  });
});
