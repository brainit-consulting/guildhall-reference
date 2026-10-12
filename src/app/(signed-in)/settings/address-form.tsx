"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { setAddressAction } from "./actions";

// Like the tax rate: `typed` comes back with each answer and keys the form, so a refused address stays to be fixed.
export function AddressForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState(setAddressAction, { error: null, saved: false, typed: current });
  return (
    <form key={state.typed} action={action} noValidate className="flex flex-col gap-3">
      <Label htmlFor="address">Your address</Label>
      <textarea id="address" name="address" rows={4} defaultValue={state.typed} autoComplete="street-address"
        aria-invalid={!!state.error} aria-describedby="address-hint"
        className="w-full rounded-sm border border-rule bg-panel px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
      <p id="address-hint" className="text-sm text-muted">
        Printed under your business name on invoice PDFs, line by line as you type it.
      </p>
      <Button type="submit" disabled={pending} className="self-start">Save address</Button>
      {state.error && <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">{state.error}</p>}
      {state.saved && <p role="status" className="text-sm text-ink">Saved. Invoice PDFs show this address.</p>}
    </form>
  );
}
