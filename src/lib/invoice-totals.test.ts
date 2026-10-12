import { describe, expect, it } from "vitest";
import { formatQuantity, formatTaxRate, invoiceTotals, parseQuantity, parseTaxRate } from "./invoice-totals";

const line = (quantity: string, unitPrice: string) => ({ quantity, unitPrice });

describe("invoiceTotals", () => {
  it("works out each line, the subtotal, the tax and the total", () => {
    const t = invoiceTotals([line("3.00", "120.00"), line("1.50", "85.00"), line("1.00", "42.50")], "15.00");
    expect(t).toEqual({ lines: ["360.00", "127.50", "42.50"], subtotal: "530.00", tax: "79.50", total: "609.50" });
  });

  it("adds 0.1 and 0.2 exactly, where floating point gives 0.30000000000000004", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    const t = invoiceTotals([line("1.00", "0.10"), line("1.00", "0.20")], "0.00");
    expect(t).toEqual({ lines: ["0.10", "0.20"], subtotal: "0.30", tax: "0.00", total: "0.30" });
  });

  it("keeps cents a float would lose on large amounts", () => {
    // 9999999999.99 x 3 overflows a double's exact range for cents
    const t = invoiceTotals([line("3.00", "9999999999.99")], "10.00");
    expect(t.subtotal).toBe("29999999999.97");
    expect(t.tax).toBe("3000000000.00"); // 2999999999.997 exactly
    expect(t.total).toBe("32999999999.97");
  });

  it("rounds each line half up to cents, and makes the subtotal the sum of the lines shown", () => {
    // 1.5 x 45.25 = 67.875 and 0.5 x 45.25 = 22.625: both round up, and the subtotal is what they add to
    expect(invoiceTotals([line("1.50", "45.25"), line("0.50", "45.25")], "0.00"))
      .toEqual({ lines: ["67.88", "22.63"], subtotal: "90.51", tax: "0.00", total: "90.51" });
    // two half cents are two cents on the page, so the subtotal is two cents too
    expect(invoiceTotals([line("0.50", "0.01"), line("0.50", "0.01")], "0.00").subtotal).toBe("0.02");
    expect(invoiceTotals([line("0.49", "0.01")], "0.00").subtotal).toBe("0.00");
    // QA's invoice: 3 x 120 + 1.5 x 45.25 + 0.5 x 45.25 at 15%
    expect(invoiceTotals([line("3", "120"), line("1.5", "45.25"), line("0.5", "45.25")], "15"))
      .toEqual({ lines: ["360.00", "67.88", "22.63"], subtotal: "450.51", tax: "67.58", total: "518.09" });
  });

  it("always prints lines that add to the subtotal, and a subtotal and tax that add to the total", () => {
    const cents = (s: string) => Math.round(Number(s) * 100);
    for (const q of ["0.33", "0.5", "1.25", "2.75", "7"]) {
      for (const p of ["0.01", "0.05", "19.99", "45.25", "1234.57"]) {
        const t = invoiceTotals([line(q, p), line(p.replace(/^\d+/, "1"), q), line("0.5", p)], "7.25");
        expect(t.lines.reduce((sum, l) => sum + cents(l), 0)).toBe(cents(t.subtotal));
        expect(cents(t.subtotal) + cents(t.tax)).toBe(cents(t.total));
      }
    }
  });

  it("rounds the tax once, from the subtotal", () => {
    // 50% of 0.03 is 0.015: 0.02
    expect(invoiceTotals([line("1.50", "0.01"), line("1", "0.01")], "50.00"))
      .toEqual({ lines: ["0.02", "0.01"], subtotal: "0.03", tax: "0.02", total: "0.05" });
    // 7.25% of 19.99 is 1.449275: 1.45
    expect(invoiceTotals([line("1", "19.99")], "7.25")).toEqual({ lines: ["19.99"], subtotal: "19.99", tax: "1.45", total: "21.44" });
  });

  it("is zero with no lines", () => {
    expect(invoiceTotals([], "15.00")).toEqual({ lines: [], subtotal: "0.00", tax: "0.00", total: "0.00" });
  });

  it("refuses values that aren't stored decimals", () => {
    expect(() => invoiceTotals([line("1.234", "1.00")], "0")).toThrow();
    expect(() => invoiceTotals([line("1", "-1.00")], "0")).toThrow();
    expect(() => invoiceTotals([], "15.555")).toThrow();
  });
});

describe("parseQuantity", () => {
  it("turns what was typed into the stored form", () => {
    expect(parseQuantity("3")).toEqual({ value: "3.00", error: null });
    expect(parseQuantity(" 1.5 ")).toEqual({ value: "1.50", error: null });
    expect(parseQuantity(".25")).toEqual({ value: "0.25", error: null });
    expect(parseQuantity("1,000")).toEqual({ value: "1000.00", error: null });
    expect(parseQuantity("007")).toEqual({ value: "7.00", error: null });
  });

  it("says what is wrong", () => {
    expect(parseQuantity("").error).toBe("Enter a quantity, like 1 or 2.5.");
    expect(parseQuantity("0").error).toBe("Enter a quantity above 0.");
    expect(parseQuantity("0.00").error).toBe("Enter a quantity above 0.");
    expect(parseQuantity("-1").error).toBe("Enter a quantity in figures, like 1 or 2.5.");
    expect(parseQuantity("two").error).toBe("Enter a quantity in figures, like 1 or 2.5.");
    expect(parseQuantity(".").error).toBe("Enter a quantity in figures, like 1 or 2.5.");
    expect(parseQuantity("1.125").error).toBe("Enter at most two decimals, like 2.25.");
    expect(parseQuantity("10000000000").error).toBe("Enter a quantity below 10,000,000,000.");
  });
});

describe("parseTaxRate", () => {
  it("turns what was typed into the stored form", () => {
    expect(parseTaxRate("15")).toEqual({ value: "15.00", error: null });
    expect(parseTaxRate("15%")).toEqual({ value: "15.00", error: null });
    expect(parseTaxRate(" 7.5 % ")).toEqual({ value: "7.50", error: null });
    expect(parseTaxRate("0")).toEqual({ value: "0.00", error: null });
    expect(parseTaxRate("100")).toEqual({ value: "100.00", error: null });
  });

  it("says what is wrong", () => {
    expect(parseTaxRate("").error).toBe("Enter a tax rate, like 15. Enter 0 if you don't charge tax.");
    expect(parseTaxRate("100.01").error).toBe("Enter a tax rate from 0 to 100.");
    expect(parseTaxRate("99999").error).toBe("Enter a tax rate from 0 to 100.");
    expect(parseTaxRate("-5").error).toBe("Enter the tax rate in figures, like 15 or 7.5.");
    expect(parseTaxRate("7.125").error).toBe("Enter at most two decimals, like 7.25.");
  });
});

describe("formatTaxRate", () => {
  it("drops the zeros after the point", () => {
    expect(formatTaxRate("15.00")).toBe("15%");
    expect(formatTaxRate("10.00")).toBe("10%");
    expect(formatTaxRate("7.50")).toBe("7.5%");
    expect(formatTaxRate("7.25")).toBe("7.25%");
    expect(formatTaxRate("0.00")).toBe("0%");
  });
});

describe("formatQuantity", () => {
  it("reads as people write it", () => {
    expect(formatQuantity("3.00")).toBe("3");
    expect(formatQuantity("10.00")).toBe("10");
    expect(formatQuantity("1.50")).toBe("1.5");
    expect(formatQuantity("0.25")).toBe("0.25");
  });
});
