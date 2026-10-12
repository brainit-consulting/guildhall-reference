"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { advanceInvoiceAction } from "../actions";

const LABEL = { Sent: "Mark sent", Paid: "Mark paid" } as const;

// "Mark sent" on a Draft, "Mark paid" on a Sent one (the page passes the next status). No question first: it is the
// next step anyway, and Edit and Delete go once it is sent.
export function Advance({ id, to }: { id: string; to: "Sent" | "Paid" }) {
  return (
    <form action={advanceInvoiceAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={to} />
      <Submit label={LABEL[to]} />
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{label}</Button>;
}
