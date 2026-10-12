"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCY } from "@/lib/money";
import type { ProjectInput } from "@/lib/projects";
import type { ProjectFormState } from "./actions";

type Props = {
  action: (prev: ProjectFormState, form: FormData) => Promise<ProjectFormState>;
  initial: ProjectInput;
  clients: { id: string; name: string }[];
  submitLabel: string;
  cancelHref: string;
};

// Add and Edit share this form: one column, labels above fields, the button at the bottom left (DESIGN.md).
export function ProjectForm({ action, initial, clients, submitLabel, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, { errors: {}, values: initial, attempt: 0 });
  const { errors, values } = state;
  const described = (field: keyof ProjectInput) => (errors[field] ? `${field}-error` : undefined);

  return (
    <form key={state.attempt} action={formAction} noValidate className="flex flex-col gap-5">
      <Field id="name" label="Name" error={errors.name}>
        <Input id="name" name="name" defaultValue={values.name} autoComplete="off" required
          aria-invalid={!!errors.name} aria-describedby={described("name")} />
      </Field>
      <Field id="clientId" label="Client" error={errors.clientId}>
        <select
          id="clientId"
          name="clientId"
          defaultValue={values.clientId}
          aria-invalid={!!errors.clientId}
          aria-describedby={described("clientId")}
          className="h-10 max-w-full rounded-sm border border-rule bg-panel px-3 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <option value="">Pick a client</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field id="budget" label={`Budget (${CURRENCY})`} error={errors.budget}>
        <Input id="budget" name="budget" inputMode="decimal" defaultValue={values.budget} autoComplete="off" placeholder="4500.00"
          className="max-w-48 text-right tabular-nums" aria-invalid={!!errors.budget} aria-describedby={described("budget")} />
      </Field>
      <Field id="startOn" label="Start" error={errors.startOn}>
        <Input id="startOn" name="startOn" type="date" defaultValue={values.startOn} className="max-w-48"
          aria-invalid={!!errors.startOn} aria-describedby={described("startOn")} />
      </Field>
      <Field id="endOn" label="End" error={errors.endOn}>
        <Input id="endOn" name="endOn" type="date" defaultValue={values.endOn} className="max-w-48"
          aria-invalid={!!errors.endOn} aria-describedby={described("endOn")} />
      </Field>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>{submitLabel}</Button>
        <Link href={cancelHref} className="tap-target text-sm text-accent underline-offset-4 hover:underline">Cancel</Link>
      </div>
    </form>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p id={`${id}-error`} role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
