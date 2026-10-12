# 041 — Invoice PDF

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-12

## Goal

"Download PDF" on every invoice gives `INV-0001.pdf`: the logo, business name and address, number, dates, client, a
ruled table of lines, subtotal, tax and total, and the status unless it is Sent; one A4 page for up to 15 lines.

## Why

Issue #94 (Intermediate chapter 11). Clients file invoices as PDFs. Builds on the invoice functions from #93.

## Approach

`@react-pdf/renderer` 4.9.0 (pinned) renders a React document to a Buffer on the server, from `getInvoice` and its
`invoiceTotals`, so the PDF can't disagree with the page. Fonts are the DESIGN.md pair (Young Serif, IBM Plex Sans) as
TTF files in the repo, since react-pdf can't use next/font. The logo is read from `BRAND_LOGO`: a PNG or JPEG as an
image, an SVG drawn with react-pdf's own Svg shapes. A route handler at `/invoices/[id]/pdf` serves it as an
attachment; the address is a new column on `business_settings`, set in Settings.

## Tasks

### Task 1: The address

- [x] **Step 1:** `business_settings.address` (text, default ''); a migration.
- [x] **Step 2:** `parseAddress`, `getBusinessAddress`, `setBusinessAddress` in `src/lib/settings.ts`; unit and
  integration tests.
- [x] **Step 3:** An address form in Settings, under Invoices.

### Task 2: The PDF

- [x] **Step 1:** `invoicePdfFileName` with a unit test; the logo reader (PNG, JPEG, simple SVG) with unit tests.
- [x] **Step 2:** The document and `renderInvoicePdf(db, id)`; fonts in `src/lib/pdf/fonts/`, traced into the route on
  Vercel through `outputFileTracingIncludes`.
- [x] **Step 3:** `GET /invoices/[id]/pdf`: signed in, 404 for no such invoice; integration test on createTestDb()
  that it returns a one-page PDF for a real invoice with 15 lines.
- [x] **Step 4:** "Download PDF" on the invoice page; Playwright test that downloads `INV-….pdf`.

## Acceptance

- [x] The PDF opens, shows the same totals as the page, and fits one A4 page with 15 lines.
- [x] Tried in a browser at 375px and desktop.

## Risks / open questions

- The fonts are Fontsource's Latin subsets (Basic Latin and Latin-1, so é, ü, ñ print); letters outside them print
  as blanks. A business writing in another script swaps the TTF files.
- An SVG logo is drawn from its rect, circle, ellipse, line, polygon, polyline and path elements; one using anything
  else (gradients, text, transforms, embedded images) is left off the PDF rather than drawn wrong. A PNG or JPEG logo
  always works.
- One page for 15 lines is tested with descriptions that wrap to two lines (about 85 characters each); longer ones
  spill onto a second page. Rows never split across pages; the header row isn't repeated there.
- The pay-by line sits in the bottom margin, so it never pushes the totals over. Paid invoices say "Paid in full."
