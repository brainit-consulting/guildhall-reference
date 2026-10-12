"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { resetDemoDataAction } from "./actions";

// A <dialog> rather than window.confirm(), as Delete does, so the question is in our words and our look.
export function ResetDemoData() {
  const [state, action] = useActionState(resetDemoDataAction, { error: null, message: null });
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  // Cancel takes the focus, so pressing Enter twice can't wipe the data.
  function open() {
    dialog.current?.showModal();
    cancel.current?.focus();
  }

  useEffect(() => {
    if (state.message || state.error) dialog.current?.close();
  }, [state]);

  return (
    <>
      <Button variant="danger" onClick={open} className="mt-6">Reset demo data</Button>
      {state.message && <p role="status" className="mt-4 text-ink">{state.message}</p>}
      {state.error && <p role="alert" className="mt-4 border-l-2 border-danger pl-3 text-sm text-danger">{state.error}</p>}
      <dialog
        ref={dialog}
        aria-labelledby="reset-question"
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-sm border border-rule bg-panel p-6 text-ink backdrop:bg-ink/40"
      >
        <p id="reset-question" className="font-display text-xl">
          Delete every company, contact, deal, activity, task and enquiry, and put the Hollow Oak demo data back? This
          can&apos;t be undone.
        </p>
        <form action={action} className="mt-6 flex items-center gap-3">
          <ConfirmButton />
          <Button type="button" ref={cancel} variant="secondary" onClick={() => dialog.current?.close()}>Cancel</Button>
        </form>
      </dialog>
    </>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="danger" disabled={pending}>Reset</Button>;
}
