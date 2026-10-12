"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ProjectStatus } from "@/lib/projects";
import { setProjectStatusAction } from "../actions";

// "Mark done" on an Active project; "Mark active" on a Done one, so a slip can be undone. No question first: either
// is one press to reverse.
export function SetStatus({ id, status }: { id: string; status: ProjectStatus }) {
  const to: ProjectStatus = status === "Active" ? "Done" : "Active";
  return (
    <form action={setProjectStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={to} />
      <Submit label={to === "Done" ? "Mark done" : "Mark active"} primary={to === "Done"} />
    </form>
  );
}

function Submit({ label, primary }: { label: string; primary: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant={primary ? "primary" : "secondary"} disabled={pending}>{label}</Button>;
}
