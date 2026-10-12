"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { makeClientAction } from "../actions";

// No question first: making a client changes nothing about the deal but its link, and pressing it twice is harmless.
export function MakeClient({ id }: { id: string }) {
  const [state, action] = useActionState(makeClientAction, { error: null });
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Submit />
      {state.error && <p role="alert" className="mt-4 border-l-2 border-danger pl-3 text-sm text-danger">{state.error}</p>}
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>Make client</Button>;
}
