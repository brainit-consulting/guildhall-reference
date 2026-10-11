"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { deleteCompanyAction } from "../actions";

// A <dialog> rather than window.confirm(), so the question is in our words and our look.
export function DeleteCompany({ id, name, contacts }: { id: string; name: string; contacts: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  // Cancel takes the focus, so pressing Enter twice can't delete. React's autoFocus fires on mount, while the dialog
  // is still closed, so it's done here.
  function open() {
    dialog.current?.showModal();
    cancel.current?.focus();
  }

  return (
    <>
      <Button variant="danger" onClick={open}>Delete</Button>
      <dialog
        ref={dialog}
        aria-labelledby="delete-question"
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-sm border border-rule bg-panel p-6 text-ink backdrop:bg-ink/40"
      >
        <p id="delete-question" className="font-display text-xl">Delete {name}? This can&apos;t be undone.</p>
        {/* the contacts are kept (the foreign key sets their company to null), and the question says so */}
        {contacts > 0 && (
          <p className="mt-3 text-sm text-ink">
            {contacts === 1 ? "Its 1 contact stays" : `Its ${contacts} contacts stay`}, with no company.
          </p>
        )}
        <form action={deleteCompanyAction} className="mt-6 flex items-center gap-3">
          <input type="hidden" name="id" value={id} />
          <ConfirmButton />
          <Button type="button" ref={cancel} variant="secondary" onClick={() => dialog.current?.close()}>Cancel</Button>
        </form>
      </dialog>
    </>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="danger" disabled={pending}>Delete</Button>;
}
