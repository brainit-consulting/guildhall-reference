"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addAllowedEmailAction } from "./actions";

export function AllowedEmailForm() {
  const [state, action, pending] = useActionState(addAllowedEmailAction, { error: null });
  const form = useRef<HTMLFormElement>(null);

  // React resets a form after its action; keep what was typed when it was refused so it can be fixed
  const last = useRef("");
  useEffect(() => {
    if (state.error && form.current) form.current.email.value = last.current;
  }, [state]);

  return (
    <form
      ref={form}
      action={action}
      onSubmit={(e) => { last.current = new FormData(e.currentTarget).get("email") as string; }}
      noValidate
      className="flex flex-col gap-3"
    >
      <Label htmlFor="email">Email</Label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input id="email" name="email" type="email" autoComplete="off" aria-describedby="email-hint" />
        <Button type="submit" disabled={pending} className="shrink-0">Add email</Button>
      </div>
      <p id="email-hint" className="text-sm text-muted">They can then create an account with this address.</p>
      {state.error && (
        <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">{state.error}</p>
      )}
    </form>
  );
}
