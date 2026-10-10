// Money (B9). Amounts are numeric(12,2) in the database and decimal strings here, never floats. Change CURRENCY to
// change how every amount on screen shows.
export const CURRENCY = "USD";

// One locale for server and browser, so both render the same text. Intl formats a decimal string exactly; it is
// never turned into a float on the way. narrowSymbol gives "$", "R", "€" rather than "ZAR".
export function formatMoney(value: string, currency: string = CURRENCY): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(
    value as Intl.StringNumericLiteral,
  );
}

// Adds stored amounts ("1250.50") exactly, in whole cents, for totals the browser works out itself (the pipeline's
// columns). Blanks (no value) add nothing.
export function addMoney(values: readonly (string | null)[]): string {
  let cents = 0n;
  for (const v of values) {
    if (!v) continue;
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(v);
    if (!match) throw new Error(`Not a stored amount: ${v}`);
    cents += BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
  }
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

// The most numeric(12,2) holds: ten digits before the point.
const MONEY = /^(\d{1,10})(?:\.(\d{1,2}))?$/;

// What was typed ("1,250", "$ 1250.5") to the stored form ("1250.50"), or a sentence saying what is wrong.
export function parseMoney(typed: string): { value: string; error: null } | { value: null; error: string } {
  // a leading currency, as people type it: "$", "R", "ZAR", "US$"
  const plain = typed.replace(/[\s,]/g, "").replace(/^(?:[a-z]{1,3})?[^\w.-]?/i, "");
  if (plain.startsWith("-")) return { value: null, error: "Enter an amount of 0 or more." };
  const match = MONEY.exec(plain.startsWith(".") ? `0${plain}` : plain);
  if (!match) {
    if (/^\d+(\.\d+)?$/.test(plain)) {
      return { value: null, error: /\.\d{3,}$/.test(plain) ? "Enter at most two decimals, like 1250.50." : "Enter an amount below 10,000,000,000." };
    }
    return { value: null, error: "Enter an amount in figures, like 1250.50." };
  }
  const whole = match[1].replace(/^0+(?=\d)/, "");
  return { value: `${whole}.${(match[2] ?? "").padEnd(2, "0")}`, error: null };
}
