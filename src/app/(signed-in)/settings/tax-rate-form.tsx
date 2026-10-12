"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTaxRate } from "@/lib/invoice-totals";
import { setTaxRateAction } from "./actions";

// `typed` comes back with each answer, and keys the form, so a refused rate stays in the field to be fixed.
export function TaxRateForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState(setTaxRateAction, { error: null, saved: null, typed: current });
  return (
    <form key={state.typed} action={action} noValidate className="flex flex-col gap-3">
      <Label htmlFor="taxRate">Tax rate (%)</Label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input id="taxRate" name="taxRate" inputMode="decimal" defaultValue={state.typed} autoComplete="off"
          className="max-w-32 text-right tabular-nums" aria-invalid={!!state.error} aria-describedby="tax-rate-hint" />
        <Button type="submit" disabled={pending} className="shrink-0 self-start">Save tax rate</Button>
      </div>
      <p id="tax-rate-hint" className="text-sm text-muted">
        Copied onto each new invoice. Invoices you have already made keep the rate they were made with.
      </p>
      {state.error && <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">{state.error}</p>}
      {state.saved && <p role="status" className="text-sm text-ink">Saved. New invoices charge {formatTaxRate(state.saved)} tax.</p>}
    </form>
  );
}
