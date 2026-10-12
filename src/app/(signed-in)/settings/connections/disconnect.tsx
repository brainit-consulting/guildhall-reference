"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { disconnectAgentAction } from "../actions";

// Asks first in a <dialog>, as Reset demo data does. The IDs ride in hidden fields, never on screen.
export function Disconnect({ agent, person, clientId, userId }: { agent: string; person: string; clientId: string; userId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  // Cancel takes the focus, so pressing Enter twice can't disconnect.
  function open() {
    dialog.current?.showModal();
    cancel.current?.focus();
  }

  return (
    <>
      <Button variant="secondary" onClick={open} aria-label={`Disconnect ${agent}, connected by ${person}`}>
        Disconnect
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={`disconnect-${clientId}-${userId}`}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-sm border border-rule bg-panel p-6 text-ink backdrop:bg-ink/40"
      >
        <p id={`disconnect-${clientId}-${userId}`} className="font-display text-xl">
          Disconnect {agent}? It stops working with your Guildhall straight away, and {person} has to allow it again
          before it can.
        </p>
        <form action={disconnectAgentAction} className="mt-6 flex flex-wrap items-center gap-3">
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="userId" value={userId} />
          <ConfirmButton />
          <Button type="button" ref={cancel} variant="secondary" onClick={() => dialog.current?.close()}>
            Cancel
          </Button>
        </form>
      </dialog>
    </>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="danger" disabled={pending}>Disconnect</Button>;
}
