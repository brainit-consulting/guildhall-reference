// I11: "Download PDF" on an invoice. Signed in, like the invoice page; the PDF is drawn in src/lib/pdf.
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { invoicePdfResponse } from "@/lib/pdf/invoice-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  return invoicePdfResponse(db, (await params).id);
}
