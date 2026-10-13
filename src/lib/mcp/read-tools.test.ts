import { describe, expect, it } from "vitest";
import { invoicePage, money, readInvoiceNumber } from "./read-tools";

describe("money for an agent", () => {
  it("gives the text a person sees and the same amount as a plain number", () => {
    expect(money("1250.50")).toEqual({ amount: 1250.5, formatted: "$1,250.50" });
    expect(money("0.00")).toEqual({ amount: 0, formatted: "$0.00" });
  });

  it("keeps the largest stored amount to the cent", () => {
    const { amount, formatted } = money("9999999999.99");
    expect(amount.toFixed(2)).toBe("9999999999.99");
    expect(formatted).toBe("$9,999,999,999.99");
  });
});

describe("an invoice number as an agent quotes it", () => {
  it("reads INV-0007, inv 7, #0007 and 7 as 7", () => {
    for (const asked of ["INV-0007", "inv-7", "INV 0007", " #0007 ", "7", "INV0007", "INV-12345"]) {
      expect(readInvoiceNumber(asked), asked).toBe(asked.includes("12345") ? 12345 : 7);
    }
  });

  it("is null for anything that isn't a number", () => {
    for (const asked of ["", "INV-", "INV-7a", "7.5", "-7", "00000000-0000-4000-8000-000000000000", "1234567890"]) {
      expect(readInvoiceNumber(asked), asked).toBeNull();
    }
  });
});

describe("the invoice page's address", () => {
  it("is the app's origin plus /invoices/<id>", () => {
    expect(invoicePage("https://crm.example.com", "abc")).toBe("https://crm.example.com/invoices/abc");
    expect(invoicePage("http://localhost:5856", "abc")).toBe("http://localhost:5856/invoices/abc");
  });
});
