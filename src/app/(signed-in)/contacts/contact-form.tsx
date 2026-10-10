"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompanyChoice } from "@/lib/companies";
import type { ContactInput } from "@/lib/contacts";
import type { ContactFormState } from "./actions";
import { CompanyPicker } from "./company-picker";

type Props = {
  action: (prev: ContactFormState, form: FormData) => Promise<ContactFormState>;
  initial: ContactInput;
  companies: CompanyChoice[];
  submitLabel: string;
  cancelHref: string;
};

// Add and Edit share this form: one column, labels above fields, the button at the bottom left (DESIGN.md).
export function ContactForm({ action, initial, companies, submitLabel, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, { errors: {}, values: initial, attempt: 0 });
  const { errors, values } = state;

  return (
    <form key={state.attempt} action={formAction} noValidate className="flex flex-col gap-5">
      <Field id="name" label="Name" error={errors.name}>
        <Input id="name" name="name" defaultValue={values.name} autoComplete="off" required
          aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined} />
      </Field>
      <Field id="email" label="Email" error={errors.email}>
        <Input id="email" name="email" type="email" defaultValue={values.email} autoComplete="off"
          aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} />
      </Field>
      <Field id="phone" label="Phone">
        <Input id="phone" name="phone" type="tel" defaultValue={values.phone} autoComplete="off" />
      </Field>
      <Field id="company" label="Company" error={errors.companyId}>
        <CompanyPicker id="company" name="companyId" companies={companies} defaultId={values.companyId}
          invalid={!!errors.companyId} describedBy={errors.companyId ? "company-error" : undefined} />
      </Field>
      <Field id="jobTitle" label="Job title">
        <Input id="jobTitle" name="jobTitle" defaultValue={values.jobTitle} autoComplete="off" />
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
