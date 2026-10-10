"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ActivityTarget } from "@/lib/activities";
import { KIND_NAMES, LOGGABLE_KINDS } from "@/lib/activity-kinds";
import { logActivityAction } from "./actions";

// One column, labels above fields, the button at the bottom left (DESIGN.md).
export function LogActivityForm({ target }: { target: ActivityTarget }) {
  const [state, formAction, pending] = useActionState(logActivityAction.bind(null, target), {
    errors: {}, values: { kind: "note", body: "" }, attempt: 0,
  });
  const { errors, values } = state;

  return (
    <form key={state.attempt} action={formAction} noValidate className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2" aria-describedby={errors.kind ? "kind-error" : undefined}>
        <legend className="mb-2 text-sm font-medium text-ink">Kind</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {LOGGABLE_KINDS.map((kind) => (
            <label key={kind} className="inline-flex items-center gap-2 text-sm text-ink">
              <input type="radio" name="kind" value={kind} defaultChecked={values.kind === kind} className="size-4 accent-accent" />
              {KIND_NAMES[kind]}
            </label>
          ))}
        </div>
        {errors.kind && <Problem id="kind-error">{errors.kind}</Problem>}
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor="activity-body">What happened</Label>
        <textarea
          id="activity-body"
          name="body"
          rows={3}
          defaultValue={values.body}
          aria-invalid={!!errors.body}
          aria-describedby={errors.body ? "activity-body-error" : undefined}
          className="w-full rounded-sm border border-rule bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        {errors.body && <Problem id="activity-body-error">{errors.body}</Problem>}
      </div>
      {errors.target && <Problem>{errors.target}</Problem>}
      <div>
        <Button type="submit" disabled={pending}>Log activity</Button>
      </div>
    </form>
  );
}

function Problem({ id, children }: { id?: string; children: React.ReactNode }) {
  return <p id={id} role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">{children}</p>;
}
