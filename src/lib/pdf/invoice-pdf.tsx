// The invoice as a PDF (I11), drawn on the server by @react-pdf/renderer from getInvoice, so its figures are the
// page's figures: both come from invoiceTotals. Laid out like the app (DESIGN.md): the two typefaces, ink on white
// paper (it gets printed), hairline rules, right-aligned money, the brand colour as the one accent.
import { join } from "node:path";
import {
  Circle, Document, Ellipse, Font, Image as PdfImage, Line, Page, Path, Polygon, Polyline, Rect, renderToBuffer, StyleSheet, Svg,
  Text, View,
} from "@react-pdf/renderer";
import { BRAND_COLOUR, BRAND_LOGO, BUSINESS_NAME } from "@/lib/brand";
import { readableShade } from "@/lib/colour";
import type { Db } from "@/lib/db/client";
import { formatDay } from "@/lib/dates";
import { formatQuantity, formatTaxRate } from "@/lib/invoice-totals";
import { formatInvoiceNumber, getInvoice, invoicePdfFileName, type InvoiceDetails } from "@/lib/invoices";
import { formatMoney } from "@/lib/money";
import { getBusinessAddress } from "@/lib/settings";
import { readLogo, type Logo, type SvgShape } from "./logo";

// react-pdf can't use next/font, so the same two faces ship as files. Read from the project folder at run time;
// next.config.ts traces them into the route on Vercel.
const fonts = join(process.cwd(), "src/lib/pdf/fonts");
Font.register({ family: "Young Serif", src: join(fonts, "YoungSerif-Regular.ttf") });
Font.register({
  family: "IBM Plex Sans",
  fonts: [
    { src: join(fonts, "IBMPlexSans-Regular.ttf"), fontWeight: 400 },
    { src: join(fonts, "IBMPlexSans-Medium.ttf"), fontWeight: 500 },
  ],
});
// Descriptions and names break between words, never mid-word with a hyphen.
Font.registerHyphenationCallback((word) => [word]);

// DESIGN.md's light colours, on white rather than paper: a printer shouldn't lay down a tint. The accent is shaded
// for white and panel the way the app shades it for paper and panel.
const WHITE = "#FFFFFF";
const PANEL = "#FBF8F2";
const INK = "#22201C";
const MUTED = "#6B645A";
const RULE = "#D9CFBD";
const ACCENT = readableShade(BRAND_COLOUR, [WHITE, PANEL]);

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 48, fontFamily: "IBM Plex Sans", fontSize: 10, color: INK, backgroundColor: WHITE },
  // Every text that can grow has a line limit (maxLines), so one A4 page holds the most the forms accept: 15 lines of
  // 100 characters, a 6-line address, long client and project names. The limits are wide enough that ordinary text
  // never reaches them; only freakishly wide text (a line of capital Ws) would be cut short, with an ellipsis.
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  business: { flex: 1, paddingRight: 16 },
  brand: { flexDirection: "row", alignItems: "center" },
  name: { fontFamily: "Young Serif", fontSize: 16, lineHeight: 1.2, maxLines: 2, textOverflow: "ellipsis" },
  address: { marginTop: 4, color: MUTED, fontSize: 8, lineHeight: 1.3 },
  addressLine: { maxLines: 1, textOverflow: "ellipsis" },
  numbering: { width: 130, alignItems: "flex-end" },
  title: { fontFamily: "Young Serif", fontSize: 24 },
  numberRow: { marginTop: 2, flexDirection: "row", alignItems: "center" },
  number: { fontSize: 12, fontWeight: 500 },
  status: { marginRight: 6, borderWidth: 1, borderColor: ACCENT, color: ACCENT, paddingVertical: 1, paddingHorizontal: 5, fontWeight: 500, fontSize: 9 },
  details: { marginTop: 12, flexDirection: "row", borderTopWidth: 0.75, borderTopColor: RULE },
  detail: { flexDirection: "row", borderBottomWidth: 0.75, borderBottomColor: RULE, paddingVertical: 3 },
  label: { width: 64, color: MUTED, fontSize: 9, paddingTop: 1 },
  detailText: { flex: 1, maxLines: 2, textOverflow: "ellipsis" },
  table: { marginTop: 10, fontSize: 9, lineHeight: 1.2 },
  row: { flexDirection: "row", borderBottomWidth: 0.75, borderBottomColor: RULE },
  headRow: { backgroundColor: PANEL, color: MUTED, fontSize: 9, fontWeight: 500 },
  cell: { paddingVertical: 2.5, paddingHorizontal: 6 },
  description: { flex: 1 },
  descriptionText: { maxLines: 2, textOverflow: "ellipsis" },
  quantity: { width: 48, textAlign: "right" },
  money: { width: 80, textAlign: "right" },
  totals: { marginTop: 6, marginLeft: "auto", width: 230 },
  total: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 0.75, borderBottomColor: RULE, paddingVertical: 3.5, paddingHorizontal: 6 },
  grand: { borderTopWidth: 1, borderTopColor: INK, fontWeight: 500, fontSize: 11 },
  // in the bottom margin, so it never pushes the totals onto a second page
  note: { position: "absolute", bottom: 22, left: 48, right: 48, color: MUTED, fontSize: 9 },
});

const SHAPE = { rect: Rect, circle: Circle, ellipse: Ellipse, line: Line, polygon: Polygon, polyline: Polyline, path: Path };
// react-pdf takes SVG's paint attributes in camelCase
const camel = (name: string) => name.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());

function LogoMark({ logo }: { logo: Logo }) {
  const size = 40;
  // PdfImage, not Image: a PDF image has no alt text, and jsx-a11y reads "Image" as an <img>
  if (logo.kind === "image") return <PdfImage src={{ data: logo.data, format: logo.format }} style={{ width: size, height: size, objectFit: "contain", marginRight: 12 }} />;
  const height = size / logo.aspect;
  return (
    <Svg viewBox={logo.viewBox} width={size} height={height} style={{ marginRight: 12 }}>
      {logo.shapes.map((shape: SvgShape, n) => {
        const Shape = SHAPE[shape.tag] as unknown as React.ComponentType<Record<string, string>>;
        return <Shape key={String(n)} {...Object.fromEntries(Object.entries(shape.attrs).map(([k, v]) => [camel(k), v]))} />;
      })}
    </Svg>
  );
}

export type InvoicePdfProps = { invoice: InvoiceDetails; address: string; logo: Logo | null };

export function InvoiceDocument({ invoice: i, address, logo }: InvoicePdfProps) {
  const number = formatInvoiceNumber(i.number);
  const totals: [string, string][] = [["Subtotal", i.totals.subtotal], [`Tax (${formatTaxRate(i.taxRate)})`, i.totals.tax]];
  return (
    <Document title={number} author={BUSINESS_NAME} subject={`Invoice ${number} for ${i.clientName}`} creator={BUSINESS_NAME} producer={BUSINESS_NAME}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View style={s.business}>
            <View style={s.brand}>
              {logo && <LogoMark logo={logo} />}
              <Text style={[s.name, { flex: 1 }]}>{BUSINESS_NAME}</Text>
            </View>
            {/* under the logo too, so an 80-character line has the width it needs */}
            {address && (
              <View style={s.address}>
                {address.split("\n").map((line, n) => <Text key={n} style={s.addressLine}>{line}</Text>)}
              </View>
            )}
          </View>
          <View style={s.numbering}>
            <Text style={s.title}>Invoice</Text>
            <View style={s.numberRow}>
              {/* Sent is what an invoice normally is; Draft and Paid are worth saying, beside the number */}
              {i.status !== "Sent" && <Text style={s.status}>{i.status}</Text>}
              <Text style={s.number}>{number}</Text>
            </View>
          </View>
        </View>

        <View style={s.details}>
          <View style={{ flex: 1, paddingRight: 24 }}>
            <View style={s.detail}>
              <Text style={s.label}>Bill to</Text>
              <Text style={s.detailText}>{i.clientName}</Text>
            </View>
            {i.projectName && (
              <View style={s.detail}>
                <Text style={s.label}>Project</Text>
                <Text style={s.detailText}>{i.projectName}</Text>
              </View>
            )}
          </View>
          <View style={{ width: 180 }}>
            <View style={s.detail}>
              <Text style={s.label}>Issue date</Text>
              <Text style={{ flex: 1, textAlign: "right" }}>{formatDay(i.issueOn)}</Text>
            </View>
            <View style={s.detail}>
              <Text style={s.label}>Due date</Text>
              <Text style={{ flex: 1, textAlign: "right" }}>{formatDay(i.dueOn)}</Text>
            </View>
          </View>
        </View>

        <View style={s.table}>
          <View style={[s.row, s.headRow]} wrap={false}>
            <Text style={[s.cell, s.description]}>Description</Text>
            <Text style={[s.cell, s.quantity]}>Quantity</Text>
            <Text style={[s.cell, s.money]}>Unit price</Text>
            <Text style={[s.cell, s.money]}>Amount</Text>
          </View>
          {i.lines.map((l, n) => (
            <View key={n} style={s.row} wrap={false}>
              <View style={[s.cell, s.description]}><Text style={s.descriptionText}>{l.description}</Text></View>
              <Text style={[s.cell, s.quantity]}>{formatQuantity(l.quantity)}</Text>
              <Text style={[s.cell, s.money]}>{formatMoney(l.unitPrice)}</Text>
              <Text style={[s.cell, s.money]}>{formatMoney(i.totals.lines[n])}</Text>
            </View>
          ))}
        </View>

        <View style={s.totals} wrap={false}>
          {totals.map(([label, value]) => (
            <View key={label} style={s.total}>
              <Text style={{ color: MUTED }}>{label}</Text>
              <Text>{formatMoney(value)}</Text>
            </View>
          ))}
          <View style={[s.total, s.grand]}>
            <Text>Total</Text>
            <Text>{formatMoney(i.totals.total)}</Text>
          </View>
        </View>

        {i.status === "Paid"
          ? <Text style={s.note} fixed>Paid in full. Thank you.</Text>
          : <Text style={s.note} fixed>Please pay by {formatDay(i.dueOn)}, quoting {number}.</Text>}
      </Page>
    </Document>
  );
}

// The PDF's bytes, or null when there is no such invoice.
export async function renderInvoicePdf(db: Db, id: string): Promise<{ fileName: string; pdf: Buffer } | null> {
  const [invoice, address] = await Promise.all([getInvoice(db, id), getBusinessAddress(db)]);
  if (!invoice) return null;
  const pdf = await renderToBuffer(<InvoiceDocument invoice={invoice} address={address} logo={readLogo(BRAND_LOGO)} />);
  return { fileName: invoicePdfFileName(invoice.number), pdf };
}

// What GET /invoices/[id]/pdf answers once the reader is signed in: the file to save, or 404.
export async function invoicePdfResponse(db: Db, id: string): Promise<Response> {
  const found = await renderInvoicePdf(db, id);
  if (!found) return new Response("No such invoice. It may have been deleted.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(new Uint8Array(found.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${found.fileName}"`,
      // a client's bill: never kept by a shared cache
      "Cache-Control": "private, no-store",
    },
  });
}
