import { describe, expect, it } from "vitest";
import { COLD_DAYS, coldBefore, isCold, quietDays, type ColdCheck } from "./cold";

// Times are New York's (the business's TIME_ZONE): EDT is UTC-4 until 1 Nov 2026, EST UTC-5 after.
const at = (iso: string) => new Date(iso);
const open = (lastActivityAt: string | null, createdAt = "2026-09-01T12:00:00Z"): ColdCheck =>
  ({ stage: "Proposal", lastActivityAt: lastActivityAt ? at(lastActivityAt) : null, createdAt: at(createdAt) });

describe("quietDays and isCold", () => {
  it("is 14 days", () => {
    expect(COLD_DAYS).toBe(14);
  });

  it("goes cold on the 14th calendar day after the last activity, whatever its hour", () => {
    const early = open("2026-10-01T04:00:00Z"); // 12:00am on 1 Oct
    const late = open("2026-10-02T03:59:59Z"); // 11:59pm on 1 Oct
    for (const deal of [early, late]) {
      expect(quietDays(deal, at("2026-10-15T04:00:00Z"))).toBe(14); // 12:00am on 15 Oct
      expect(isCold(deal, at("2026-10-15T04:00:00Z"))).toBe(true);
      expect(quietDays(deal, at("2026-10-15T03:59:59Z"))).toBe(13); // 11:59pm on 14 Oct
      expect(isCold(deal, at("2026-10-15T03:59:59Z"))).toBe(false);
    }
    expect(quietDays(early, at("2026-10-17T16:00:00Z"))).toBe(16);
  });

  it("counts from the day the deal was added when nothing was ever logged", () => {
    const deal = open(null, "2026-10-01T14:00:00Z");
    expect(quietDays(deal, at("2026-10-14T20:00:00Z"))).toBe(13);
    expect(isCold(deal, at("2026-10-14T20:00:00Z"))).toBe(false);
    expect(isCold(deal, at("2026-10-15T20:00:00Z"))).toBe(true);
  });

  it("is never cold once Won or Lost, and is cold in every open stage", () => {
    const now = at("2026-12-01T17:00:00Z");
    const quiet = open("2026-10-01T17:00:00Z");
    expect(isCold({ ...quiet, stage: "Won" }, now)).toBe(false);
    expect(isCold({ ...quiet, stage: "Lost" }, now)).toBe(false);
    for (const stage of ["New", "Contacted", "Proposal"] as const) expect(isCold({ ...quiet, stage }, now)).toBe(true);
  });

  it("counts calendar days across New York's 1 Nov clock change", () => {
    // 11:30pm EDT on 25 Oct; the 14th day after is 8 Nov, which starts at 05:00Z (EST).
    const deal = open("2026-10-26T03:30:00Z");
    expect(quietDays(deal, at("2026-11-08T04:59:59Z"))).toBe(13); // 11:59pm EST on 7 Nov
    expect(isCold(deal, at("2026-11-08T04:59:59Z"))).toBe(false);
    expect(quietDays(deal, at("2026-11-08T05:00:00Z"))).toBe(14);
    expect(isCold(deal, at("2026-11-08T05:00:00Z"))).toBe(true);
  });

  it("is not cold for activity logged today, even a little ahead of the clock", () => {
    expect(quietDays(open("2026-10-15T15:00:00Z"), at("2026-10-15T14:00:00Z"))).toBe(0);
    expect(isCold(open("2026-10-15T15:00:00Z"), at("2026-10-15T14:00:00Z"))).toBe(false);
  });
});

describe("coldBefore", () => {
  it("is the start of the business's day 13 days before today", () => {
    expect(coldBefore(at("2026-10-15T16:00:00Z")).toISOString()).toBe("2026-10-02T04:00:00.000Z");
    expect(coldBefore(at("2026-11-08T05:00:00Z")).toISOString()).toBe("2026-10-26T04:00:00.000Z"); // EDT that day
    expect(coldBefore(at("2026-11-20T16:00:00Z")).toISOString()).toBe("2026-11-07T05:00:00.000Z"); // EST
  });

  it("draws the same line as isCold", () => {
    for (const now of ["2026-10-15T04:00:00Z", "2026-11-08T05:00:00Z", "2026-11-14T03:00:00Z", "2026-03-20T12:00:00Z"]) {
      const line = coldBefore(at(now));
      expect(isCold(open(new Date(line.getTime() - 1).toISOString()), at(now))).toBe(true);
      expect(isCold(open(line.toISOString()), at(now))).toBe(false);
    }
  });
});
