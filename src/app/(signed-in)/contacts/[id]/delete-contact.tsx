"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { deleteContactAction } from "../actions";

// A <dialog> rather than window.confirm(), so the question is in our words and our look.
export function DeleteContact({ id, name }: { id: string; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <Button variant="danger" onClick={() => dialog.current?.showModal()}>Delete</Button>
      <dialog
        ref={dialog}
        aria-labelledby="delete-question"
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-sm border border-rule bg-panel p-6 text-ink backdrop:bg-ink/40"
      >
        <p id="delete-question" className="font-display text-xl">Delete {name}? This can&apos;t be undone.</p>
        <form action={deleteContactAction} className="mt-6 flex items-center gap-3">
          <input type="hidden" name="id" value={id} />
          <ConfirmButton />
          <Button type="button" variant="secondary" onClick={() => dialog.current?.close()}>Cancel</Button>
        </form>
      </dialog>
    </>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="danger" disabled={pending}>Delete</Button>;
}
