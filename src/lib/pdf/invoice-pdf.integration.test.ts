// I11: GET /invoices/[id]/pdf answers a real invoice with its PDF, on a fresh database. The route's own session check
// and database are swapped for the test's; everything after them is the real code.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { makeClient } from "@/lib/clients";
import { createCompany, EMPTY_COMPANY } from "@/lib/companies";
import { createDeal, EMPTY_DEAL } from "@/lib/deals";
import {
  advanceInvoice, createInvoice, deleteInvoice, formatInvoiceNumber, getInvoice, MAX_DESCRIPTION, type InvoiceInput,
} from "@/lib/invoices";
import { createProject } from "@/lib/projects";
import { getBusinessAddress, getTaxRate, MAX_ADDRESS_LINE, MAX_ADDRESS_LINES, setBusinessAddress, setTaxRate } from "@/lib/settings";
import { renderInvoicePdf } from "./invoice-pdf";

const holder = vi.hoisted(() => ({ db: null as unknown as Db }));
vi.mock("@/lib/db/client", async (original) => ({
  ...(await original<typeof import("@/lib/db/client")>()),
  db: new Proxy({}, { get: (_t, prop) => Reflect.get(holder.db, prop, holder.db) }),
}));
vi.mock("@/lib/auth/session", () => ({ requireSession: vi.fn(async () => ({ user: { role: "owner" } })) }));

const { GET } = await import("@/app/(signed-in)/invoices/[id]/pdf/route");
const { requireSession } = await import("@/lib/auth/session");

let t: { db: Db; close(): Promise<void> };
beforeEach(async () => { t = await createTestDb(); holder.db = t.db; });
afterEach(() => t.close());

const get = (id: string) => GET(new Request(`http://localhost/invoices/${id}/pdf`), { params: Promise.resolve({ id }) });

async function newClient(name: string) {
  const companyId = (await createCompany(t.db, { ...EMPTY_COMPANY, name })).id!;
  const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: `Work for ${name}`, stage: "Won", companyId })).id!;
  return (await makeClient(t.db, dealId))!.id!;
}

// Fifteen lines of the length a joiner writes, the most the issue promises on one page.
const FIFTEEN = Array.from({ length: 15 }, (_, n) => ({
  description: `Oak shelf ${n + 1}, planed and oiled, fitted to the alcove left of the chimney breast`,
  quantity: "1.5", unitPrice: "120.10",
}));

async function add(fields: Partial<InvoiceInput> = {}) {
  const clientId = await newClient("Mill House Bakery");
  const saved = await createInvoice(t.db, { clientId, projectId: "", issueOn: "2026-10-12", dueOn: "2026-11-11", lines: FIFTEEN, ...fields });
  if (saved.errors) throw new Error(JSON.stringify(saved.errors));
  return saved;
}

// pdfkit writes each page's dictionary uncompressed: one "/Type /Page" per page ("/Pages" is the tree).
const pages = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type \/Page\b(?!s)/g) ?? []).length;

describe("the address in Settings", () => {
  it("is blank until set, keeps the tax rate when saved, and the tax rate keeps it", async () => {
    expect(await getBusinessAddress(t.db)).toBe("");
    await setTaxRate(t.db, "15");
    expect(await setBusinessAddress(t.db, " 12 Mill Lane \n\n Hollow Oak ")).toEqual({ value: "12 Mill Lane\nHollow Oak", error: null });
    expect(await getTaxRate(t.db)).toBe("15.00");
    await setTaxRate(t.db, "7.5");
    expect(await getBusinessAddress(t.db)).toBe("12 Mill Lane\nHollow Oak");
  });

  it("refuses an address too long to print and keeps the old one", async () => {
    await setBusinessAddress(t.db, "12 Mill Lane");
    expect((await setBusinessAddress(t.db, "1\n2\n3\n4\n5\n6\n7")).error).toBe("Fit the address on 6 lines or fewer.");
    expect(await getBusinessAddress(t.db)).toBe("12 Mill Lane");
    expect(await setBusinessAddress(t.db, "")).toEqual({ value: "", error: null });
    expect(await getBusinessAddress(t.db)).toBe("");
  });
});

// Text of exactly `n` characters, ending in a letter: ordinary words, or the widest letters there are.
const PROSE = "Oak shelf, planed and oiled, fitted to the alcove left of the chimney breast, with brass brackets and ";
const text = (n: number, wide: boolean) => (wide ? "MW ".repeat(n) : PROSE.repeat(Math.ceil(n / PROSE.length) + 1)).slice(0, n - 1) + "x";

describe("one A4 page for 15 lines, whatever the forms accept", () => {
  for (const wide of [false, true]) {
    it(`fits the most of everything, as ${wide ? "the widest letters" : "ordinary words"}, as a Draft, Sent and Paid`, async () => {
      await setTaxRate(t.db, "15");
      const address = Array.from({ length: MAX_ADDRESS_LINES }, () => text(MAX_ADDRESS_LINE, wide)).join("\n");
      expect((await setBusinessAddress(t.db, address)).error).toBeNull();
      // names have no limit in the forms; the PDF gives each two lines. Amounts are big for a joiner: $99,974,990.00 a line.
      const clientId = await newClient(text(300, wide));
      const projectId = (await createProject(t.db, { name: text(300, wide), clientId, budget: "4500", startOn: "2026-10-01", endOn: "2026-12-01" })).id!;
      const lines = Array.from({ length: 15 }, () => ({ description: text(MAX_DESCRIPTION, wide), quantity: "999.75", unitPrice: "99999.99" }));
      const saved = await createInvoice(t.db, { clientId, projectId, issueOn: "2026-10-12", dueOn: "2026-11-11", lines });
      if (saved.errors) throw new Error(JSON.stringify(saved.errors));

      for (const step of [null, "Sent", "Paid"] as const) {
        if (step) expect(await advanceInvoice(t.db, saved.id, step)).toBe(true);
        const pdf = (await renderInvoicePdf(t.db, saved.id))!.pdf;
        expect(pages(pdf), `${step ?? "Draft"}`).toBe(1);
      }
    });
  }
});

describe("GET /invoices/[id]/pdf", () => {
  it("returns the invoice as a PDF named for its number, on one A4 page with 15 lines", async () => {
    await setTaxRate(t.db, "15");
    await setBusinessAddress(t.db, "12 Mill Lane\nHollow Oak, VT 05001");
    const saved = await add();

    const res = await get(saved.id);
    expect(requireSession).toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe(`attachment; filename="${formatInvoiceNumber(saved.number)}.pdf"`);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    const pdf = Buffer.from(await res.arrayBuffer());
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pages(pdf)).toBe(1);
    // A4 is 595.28 x 841.89 points
    expect(pdf.toString("latin1")).toMatch(/\/MediaBox \[0 0 595\.2\d* 841\.8\d*\]/);
  });

  it("draws each status: a Draft, a Sent and a Paid invoice all render", async () => {
    const saved = await add({ lines: FIFTEEN.slice(0, 3) });
    for (const step of [null, "Sent", "Paid"] as const) {
      if (step) expect(await advanceInvoice(t.db, saved.id, step)).toBe(true);
      expect((await get(saved.id)).status).toBe(200);
    }
  });

  it("is built from the same figures as the invoice page", async () => {
    await setTaxRate(t.db, "15");
    const saved = await add({ lines: [{ description: "Fitting", quantity: "1.5", unitPrice: "85" }] });
    const found = await renderInvoicePdf(t.db, saved.id);
    expect(found?.fileName).toBe(`${formatInvoiceNumber(saved.number)}.pdf`);
    expect((await getInvoice(t.db, saved.id))?.totals).toEqual({ lines: ["127.50"], subtotal: "127.50", tax: "19.13", total: "146.63" });
  });

  it("answers 404 for an invoice that doesn't exist or was deleted", async () => {
    const saved = await add({ lines: FIFTEEN.slice(0, 1) });
    expect(await deleteInvoice(t.db, saved.id)).toBe(true);
    expect((await get(saved.id)).status).toBe(404);
    expect((await get("not-an-id")).status).toBe(404);
  });
});
