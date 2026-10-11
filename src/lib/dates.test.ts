import { describe, expect, it } from "vitest";
import {
  addDays, dayStartIn, daysAgo, daysBetween, dueWhen, formatDay, formatMonth, isDay, isMonth, monthIn, nextMonthStart, TIME_ZONE,
  todayIn,
} from "./dates";

describe("monthIn", () => {
  it("is the month in that zone, so New York's last evening of a month is still that month", () => {
    expect(monthIn("America/New_York", new Date("2026-11-01T03:30:00Z"))).toBe("2026-10"); // 11:30pm EDT, 31 Oct
    expect(monthIn("America/New_York", new Date("2026-11-01T04:00:00Z"))).toBe("2026-11"); // midnight EDT
    expect(monthIn("America/New_York", new Date("2027-01-01T04:59:59Z"))).toBe("2026-12"); // EST, New Year's Eve
    expect(monthIn("America/New_York", new Date("2027-01-01T05:00:00Z"))).toBe("2027-01");
  });

  it("works ahead of UTC too, and gives a real month for the business's zone", () => {
    expect(monthIn("Pacific/Auckland", new Date("2026-10-31T11:00:00Z"))).toBe("2026-11");
    expect(isMonth(monthIn(TIME_ZONE, new Date()))).toBe(true);
  });
});

describe("isMonth", () => {
  it("takes a real month as YYYY-MM", () => {
    expect(isMonth("2026-10")).toBe(true);
    expect(isMonth("2026-01")).toBe(true);
    expect(isMonth("2026-12")).toBe(true);
  });

  it("refuses anything else", () => {
    for (const s of ["2026-13", "2026-00", "2026-1", "26-10", "2026-10-01", "2026/10", "junk", "", " 2026-10"]) {
      expect(isMonth(s), s).toBe(false);
    }
  });
});

describe("formatMonth", () => {
  it("names the month in full, then the year", () => {
    expect(formatMonth("2026-10")).toBe("October 2026");
    expect(formatMonth("2026-09")).toBe("September 2026");
    expect(formatMonth("2027-01")).toBe("January 2027");
    expect(formatMonth("2026-12")).toBe("December 2026");
  });
});

describe("nextMonthStart", () => {
  it("is the 1st of the next month, into the next year after December", () => {
    expect(nextMonthStart("2026-10")).toBe("2026-11-01");
    expect(nextMonthStart("2026-09")).toBe("2026-10-01");
    expect(nextMonthStart("2026-12")).toBe("2027-01-01");
  });
});

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

describe("daysBetween and addDays", () => {
  it("count and step calendar days across months, years and clock changes", () => {
    expect(daysBetween("2026-10-01", "2026-10-15")).toBe(14);
    expect(daysBetween("2026-10-15", "2026-10-01")).toBe(-14);
    expect(daysBetween("2026-10-25", "2026-11-08")).toBe(14); // New York falls back on 1 Nov
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
    expect(addDays("2026-10-15", -13)).toBe("2026-10-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("dayStartIn", () => {
  it("is the instant the day's midnight comes in that zone", () => {
    expect(dayStartIn("America/New_York", "2026-10-02").toISOString()).toBe("2026-10-02T04:00:00.000Z"); // EDT
    expect(dayStartIn("America/New_York", "2026-12-01").toISOString()).toBe("2026-12-01T05:00:00.000Z"); // EST
    expect(dayStartIn("UTC", "2026-10-02").toISOString()).toBe("2026-10-02T00:00:00.000Z");
    expect(dayStartIn("Africa/Johannesburg", "2026-10-02").toISOString()).toBe("2026-10-01T22:00:00.000Z");
    expect(dayStartIn("Pacific/Auckland", "2027-01-01").toISOString()).toBe("2026-12-31T11:00:00.000Z");
  });

  it("follows New York's clock changes on 8 Mar and 1 Nov 2026", () => {
    expect(dayStartIn("America/New_York", "2026-03-08").toISOString()).toBe("2026-03-08T05:00:00.000Z"); // still EST
    expect(dayStartIn("America/New_York", "2026-03-09").toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect(dayStartIn("America/New_York", "2026-11-01").toISOString()).toBe("2026-11-01T04:00:00.000Z"); // still EDT
    expect(dayStartIn("America/New_York", "2026-11-02").toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });

  it("starts the day todayIn names", () => {
    for (const day of ["2026-03-08", "2026-03-09", "2026-11-01", "2026-11-02", "2026-07-04"]) {
      const start = dayStartIn(TIME_ZONE, day);
      expect(todayIn(TIME_ZONE, start)).toBe(day);
      expect(todayIn(TIME_ZONE, new Date(start.getTime() - 1))).toBe(addDays(day, -1));
    }
  });
});
