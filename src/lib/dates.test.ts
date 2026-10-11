import { describe, expect, it } from "vitest";
import { daysAgo, dueWhen, formatDay, isDay, TIME_ZONE, todayIn } from "./dates";

describe("todayIn", () => {
  it("is the calendar day in that zone, either side of its midnight", () => {
    expect(todayIn("America/New_York", new Date("2026-10-12T03:30:00Z"))).toBe("2026-10-11"); // 11:30pm EDT
    expect(todayIn("America/New_York", new Date("2026-10-12T03:59:59Z"))).toBe("2026-10-11");
    expect(todayIn("America/New_York", new Date("2026-10-12T04:00:00Z"))).toBe("2026-10-12"); // midnight EDT
    expect(todayIn("America/New_York", new Date("2026-12-01T04:30:00Z"))).toBe("2026-11-30"); // EST, an hour later
    expect(todayIn("America/New_York", new Date("2026-12-01T05:00:00Z"))).toBe("2026-12-01");
  });

  it("works for any zone, ahead of UTC too", () => {
    expect(todayIn("Africa/Johannesburg", new Date("2026-10-11T22:30:00Z"))).toBe("2026-10-12");
    expect(todayIn("UTC", new Date("2026-12-31T23:59:59Z"))).toBe("2026-12-31");
    expect(todayIn("Pacific/Auckland", new Date("2026-12-31T11:00:00Z"))).toBe("2027-01-01");
  });

  it("is set to the business's zone", () => {
    expect(TIME_ZONE).toBe("America/New_York");
    expect(isDay(todayIn(TIME_ZONE, new Date()))).toBe(true);
  });
});

describe("dueWhen", () => {
  it("says overdue, today or later against today", () => {
    expect(dueWhen("2026-10-11", "2026-10-12")).toBe("overdue");
    expect(dueWhen("2025-12-31", "2026-01-01")).toBe("overdue");
    expect(dueWhen("2026-10-12", "2026-10-12")).toBe("today");
    expect(dueWhen("2026-10-13", "2026-10-12")).toBe("later");
    expect(dueWhen("2027-01-01", "2026-12-31")).toBe("later");
  });
});

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

describe("isDay", () => {
  it("takes a real calendar day as YYYY-MM-DD and nothing else", () => {
    expect(isDay("2026-10-12")).toBe(true);
    expect(isDay("2028-02-29")).toBe(true);
    for (const s of ["", "2026-02-30", "2027-02-29", "2026-13-01", "2026-10-1", "12 Oct 2026", "2026-10-12T00:00"]) {
      expect(isDay(s)).toBe(false);
    }
  });
});
