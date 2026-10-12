import { describe, expect, it } from "vitest";
import {
  checkInvoice, DUE_BEFORE_ISSUE, formatInvoiceNumber, isOverdue, MAX_LINES, NO_LINES, PICK_CLIENT, type InvoiceInput,
} from "./invoices";

const CLIENT = "6f1c2a3e-1d2b-4c5d-8e9f-0a1b2c3d4e5f";
const input = (fields: Partial<InvoiceInput> = {}): InvoiceInput => ({
  clientId: CLIENT, projectId: "", issueOn: "2026-10-12", dueOn: "2026-11-11",
  lines: [{ description: "Oak shelves", quantity: "3", unitPrice: "120" }], ...fields,
});

describe("formatInvoiceNumber", () => {
  it("reads INV- and four digits, and keeps growing past 9999", () => {
    expect(formatInvoiceNumber(1)).toBe("INV-0001");
    expect(formatInvoiceNumber(42)).toBe("INV-0042");
    expect(formatInvoiceNumber(10000)).toBe("INV-10000");
  });
});

describe("isOverdue", () => {
  it("is a Sent invoice whose due day has gone by", () => {
    expect(isOverdue({ status: "Sent", dueOn: "2026-10-11" }, "2026-10-12")).toBe(true);
    expect(isOverdue({ status: "Sent", dueOn: "2026-10-12" }, "2026-10-12")).toBe(false); // due today isn't late yet
    expect(isOverdue({ status: "Draft", dueOn: "2026-10-01" }, "2026-10-12")).toBe(false);
    expect(isOverdue({ status: "Paid", dueOn: "2026-10-01" }, "2026-10-12")).toBe(false);
  });
});

describe("checkInvoice", () => {
  it("trims and turns figures into their stored form, dropping blank lines", () => {
    const checked = checkInvoice(input({
      lines: [{ description: " Oak shelves ", quantity: "1.5", unitPrice: "$1,200" }, { description: " ", quantity: "", unitPrice: "" }],
    }));
    expect(checked.values).toEqual({
      clientId: CLIENT, projectId: null, issueOn: "2026-10-12", dueOn: "2026-11-11",
      lines: [{ description: "Oak shelves", quantity: "1.50", unitPrice: "1200.00" }],
    });
  });

  it("allows a due date on the issue date, not before it", () => {
    expect(checkInvoice(input({ dueOn: "2026-10-12" })).errors).toBeNull();
    expect(checkInvoice(input({ dueOn: "2026-10-11" })).errors).toEqual({ dueOn: DUE_BEFORE_ISSUE });
  });

  it("says what is missing", () => {
    expect(checkInvoice(input({ clientId: "", issueOn: "", dueOn: "2026-02-30", lines: [] })).errors).toEqual({
      clientId: PICK_CLIENT, issueOn: "Enter the issue date.", dueOn: "Enter a date, like 12 Oct 2026.", lines: NO_LINES,
    });
  });

  it("says what is wrong on each line, counting lines as they were sent", () => {
    const checked = checkInvoice(input({
      lines: [
        { description: "", quantity: "", unitPrice: "" },
        { description: "", quantity: "0", unitPrice: "12.345" },
        { description: "Fitting", quantity: "2", unitPrice: "" },
      ],
    }));
    expect(checked.errors).toEqual({
      line: {
        1: { description: "Enter what this line is for.", quantity: "Enter a quantity above 0.", unitPrice: "Enter at most two decimals, like 1250.50." },
        2: { unitPrice: "Enter a unit price, like 85.00." },
      },
    });
  });

  it("holds at most MAX_LINES lines", () => {
    const line = { description: "Hour", quantity: "1", unitPrice: "85" };
    expect(checkInvoice(input({ lines: Array(MAX_LINES).fill(line) })).errors).toBeNull();
    expect(checkInvoice(input({ lines: Array(MAX_LINES + 1).fill(line) })).errors?.lines).toMatch(/at most 50 lines/);
  });
});
