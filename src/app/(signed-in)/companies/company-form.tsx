"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompanyInput } from "@/lib/companies";
import type { CompanyFormState } from "./actions";

type Props = {
  action: (prev: CompanyFormState, form: FormData) => Promise<CompanyFormState>;
  initial: CompanyInput;
  submitLabel: string;
  cancelHref: string;
};

// Add and Edit share this form: one column, labels above fields, the button at the bottom left (DESIGN.md).
export function CompanyForm({ action, initial, submitLabel, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, { errors: {}, values: initial, attempt: 0 });
  const { errors, values } = state;

  return (
    <form key={state.attempt} action={formAction} noValidate className="flex flex-col gap-5">
      <Field id="name" label="Name" error={errors.name}>
        <Input id="name" name="name" defaultValue={values.name} autoComplete="off" required
          aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined} />
      </Field>
      {/* type="text", not "url": the browser would refuse "guildhall.example" without its https:// */}
      <Field id="website" label="Website">
        <Input id="website" name="website" inputMode="url" defaultValue={values.website} autoComplete="off" />
      </Field>
      <Field id="phone" label="Phone">
        <Input id="phone" name="phone" type="tel" defaultValue={values.phone} autoComplete="off" />
      </Field>
      <Field id="notes" label="Notes">
        <textarea
          id="notes"
          name="notes"
          rows={5}
          defaultValue={values.notes}
          className="w-full rounded-sm border border-rule bg-panel px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </Field>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>{submitLabel}</Button>
        <Link href={cancelHref} className="text-sm text-accent underline-offset-4 hover:underline">Cancel</Link>
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
