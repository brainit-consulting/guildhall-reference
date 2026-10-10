import { describe, expect, it } from "vitest";
import { CURRENCY, formatMoney, parseMoney } from "./money";

// Intl puts a no-break space between "R" and the figure.
const nbsp = (s: string) => s.replace(/ /g, " ");

describe("formatMoney", () => {
  it("shows two decimals and thousands separators in the currency set in one place", () => {
    expect(CURRENCY).toBe("USD");
    expect(formatMoney("1250.50")).toBe("$1,250.50");
    expect(formatMoney("1250")).toBe("$1,250.00");
    expect(formatMoney("0")).toBe("$0.00");
  });

  it("follows the currency it is given", () => {
    expect(formatMoney("1250.50", "ZAR")).toBe(nbsp("R 1,250.50"));
    expect(formatMoney("1250.50", "EUR")).toBe("€1,250.50");
  });

  it("is exact for the largest amount the database holds, and for sums beyond a float's precision", () => {
    expect(formatMoney("9999999999.99")).toBe("$9,999,999,999.99");
    expect(formatMoney("123456789012345678.91")).toBe("$123,456,789,012,345,678.91");
  });
});

describe("parseMoney", () => {
  it("turns what was typed into the stored form", () => {
    expect(parseMoney("1250")).toEqual({ value: "1250.00", error: null });
    expect(parseMoney("1,250.5")).toEqual({ value: "1250.50", error: null });
    expect(parseMoney(" $ 1 250.05 ")).toEqual({ value: "1250.05", error: null });
    expect(parseMoney("R1250")).toEqual({ value: "1250.00", error: null });
    expect(parseMoney(".5")).toEqual({ value: "0.50", error: null });
    expect(parseMoney("007")).toEqual({ value: "7.00", error: null });
    expect(parseMoney("9999999999.99")).toEqual({ value: "9999999999.99", error: null });
  });

  it("says what is wrong with an amount it can't store exactly", () => {
    expect(parseMoney("12.345").error).toBe("Enter at most two decimals, like 1250.50.");
    expect(parseMoney("10000000000").error).toBe("Enter an amount below 10,000,000,000.");
    expect(parseMoney("-5").error).toBe("Enter an amount of 0 or more.");
    expect(parseMoney("about 500").error).toBe("Enter an amount in figures, like 1250.50.");
    expect(parseMoney("1e5").error).toBe("Enter an amount in figures, like 1250.50.");
    expect(parseMoney("1.2.3").error).toBe("Enter an amount in figures, like 1250.50.");
  });
});
