// Invoice arithmetic (I11). Amounts, quantities and the tax rate stay decimal strings and are worked in whole numbers
// (BigInt), so 0.1 + 0.2 is 0.30 and nothing drifts. No database here: the invoice form shows the same totals as it is
// typed, and the pages, the PDF and the agent's tools all use this one function.

export type TotalsLine = { quantity: string; unitPrice: string };
export type InvoiceTotals = { lines: string[]; subtotal: string; tax: string; total: string };

// "12.5" with places 2 is 1250n. Throws on anything that isn't a plain non-negative decimal with at most `places`
// decimals: the callers check what was typed first, so this is a programming error.
function scaled(value: string, places: number): bigint {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match || (match[2] ?? "").length > places) throw new Error(`Not a decimal with at most ${places} places: ${value}`);
  return BigInt(match[1] + (match[2] ?? "").padEnd(places, "0"));
}

// A non-negative value held at 10^-places, in whole cents, half up (0.005 is 0.01).
function roundCents(value: bigint, places: number): bigint {
  const unit = 10n ** BigInt(places - 2);
  return (value + unit / 2n) / unit;
}

function centsText(cents: bigint): string {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

// Each line is quantity x unit price; tax is the subtotal x the rate (a percentage). Every product is worked
// exactly and rounded to cents once: a line from its exact quantity x price, the tax from the subtotal. The subtotal
// is the sum of the rounded lines and the total the subtotal plus the rounded tax, so every figure printed on the
// invoice adds up: the lines to the subtotal, the subtotal and tax to the total.
export function invoiceTotals(lines: readonly TotalsLine[], taxRate: string): InvoiceTotals {
  const rate = scaled(taxRate, 2); // 15.00% is 1500n
  // quantity (2 places) x price (2 places) is 4 places; rounded to cents
  const lineCents = lines.map((l) => roundCents(scaled(l.quantity, 2) * scaled(l.unitPrice, 2), 4));
  const subtotal = lineCents.reduce((sum, c) => sum + c, 0n);
  // subtotal (2 places) x rate (2 places) / 100 for the percentage: 6 places
  const tax = roundCents(subtotal * rate, 6);
  return {
    lines: lineCents.map(centsText),
    subtotal: centsText(subtotal),
    tax: centsText(tax),
    total: centsText(subtotal + tax),
  };
}

type Parsed = { value: string; error: null } | { value: null; error: string };

// A plain decimal as typed ("1,250.5", " 2 "), without spaces or thousands commas.
const plain = (typed: string) => typed.replace(/[\s,]/g, "");

// What was typed as a quantity ("2", "1.5", "0.25") to the stored form ("1.50"): above 0, at most two decimals, as
// much as numeric(12,2) holds.
export function parseQuantity(typed: string): Parsed {
  const p = plain(typed);
  if (!p) return { value: null, error: "Enter a quantity, like 1 or 2.5." };
  const match = /^(\d+)?(?:\.(\d+))?$/.exec(p);
  if (!match || (!match[1] && !match[2])) return { value: null, error: "Enter a quantity in figures, like 1 or 2.5." };
  if ((match[2] ?? "").length > 2) return { value: null, error: "Enter at most two decimals, like 2.25." };
  const whole = (match[1] ?? "0").replace(/^0+(?=\d)/, "");
  if (whole.length > 10) return { value: null, error: "Enter a quantity below 10,000,000,000." };
  const value = `${whole}.${(match[2] ?? "").padEnd(2, "0")}`;
  if (scaled(value, 2) === 0n) return { value: null, error: "Enter a quantity above 0." };
  return { value, error: null };
}

// What was typed as the tax rate ("15", "15%", "7.5") to the stored form ("15.00"): 0 to 100, at most two decimals.
export function parseTaxRate(typed: string): Parsed {
  const p = plain(typed).replace(/%$/, "");
  if (!p) return { value: null, error: "Enter a tax rate, like 15. Enter 0 if you don't charge tax." };
  const match = /^(\d+)?(?:\.(\d+))?$/.exec(p);
  if (!match || (!match[1] && !match[2])) return { value: null, error: "Enter the tax rate in figures, like 15 or 7.5." };
  if ((match[2] ?? "").length > 2) return { value: null, error: "Enter at most two decimals, like 7.25." };
  const value = `${(match[1] ?? "0").replace(/^0+(?=\d)/, "")}.${(match[2] ?? "").padEnd(2, "0")}`;
  if (match[1] && match[1].replace(/^0+/, "").length > 3) return { value: null, error: "Enter a tax rate from 0 to 100." };
  if (scaled(value, 2) > 10000n) return { value: null, error: "Enter a tax rate from 0 to 100." };
  return { value, error: null };
}

// Only zeros after the point go, so "10.00" is 10 and "1.50" is 1.5.
const trimZeros = (value: string) => (value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value);

// "15.00" reads "15%", "7.50" reads "7.5%".
export function formatTaxRate(rate: string): string {
  return `${trimZeros(rate)}%`;
}

// A stored quantity as people write it: "3.00" reads "3", "1.50" reads "1.5".
export function formatQuantity(quantity: string): string {
  return trimZeros(quantity);
}
