# Invoice PDF

My clients expect a PDF they can file.

## What it should do
- "Download PDF" on every invoice, made on the server with `@react-pdf/renderer` (pinned exactly).
- The PDF follows `DESIGN.md`: my logo and business name, the invoice number and dates, the client, the lines in a ruled
  table with right-aligned amounts, subtotal, tax and total, and the status if it isn't Sent.
- The file is named `INV-0001.pdf`.
- My business name comes from `src/lib/brand.ts` (Beginner chapter 17); my address from Settings (add it there if it
  isn't yet).

## Done when
- [ ] The PDF opens, shows the same totals as the page, and prints on one A4 page for up to 15 lines.
- [ ] Tests: an integration test that the PDF route returns a PDF for a real invoice; a unit test for the file name.
- [ ] Tried in a browser

Depends on #<number of the issue "Invoices">
