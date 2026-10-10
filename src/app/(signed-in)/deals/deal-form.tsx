"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompanyChoice } from "@/lib/companies";
import type { ContactChoice } from "@/lib/contacts";
import { DEAL_STAGES } from "@/lib/deal-stages";
import type { DealInput } from "@/lib/deals";
import { CURRENCY } from "@/lib/money";
import { CompanyPicker } from "../contacts/company-picker";
import type { DealFormState } from "./actions";
import { ContactPicker } from "./contact-picker";

type Props = {
  action: (prev: DealFormState, form: FormData) => Promise<DealFormState>;
  initial: DealInput;
  contacts: ContactChoice[];
  companies: CompanyChoice[];
  submitLabel: string;
  cancelHref: string;
};

// Add and Edit share this form: one column, labels above fields, the button at the bottom left (DESIGN.md).
export function DealForm({ action, initial, contacts, companies, submitLabel, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, { errors: {}, values: initial, attempt: 0 });
  const { errors, values } = state;
  const described = (field: keyof DealInput, id: string) => (errors[field] ? `${id}-error` : undefined);

  return (
    <form key={state.attempt} action={formAction} noValidate className="flex flex-col gap-5">
      <Field id="title" label="Title" error={errors.title}>
        <Input id="title" name="title" defaultValue={values.title} autoComplete="off" required
          aria-invalid={!!errors.title} aria-describedby={described("title", "title")} />
      </Field>
      <Field id="value" label={`Value (${CURRENCY})`} error={errors.value}>
        <Input id="value" name="value" inputMode="decimal" defaultValue={values.value} autoComplete="off" placeholder="1250.00"
          className="max-w-48 text-right tabular-nums" aria-invalid={!!errors.value} aria-describedby={described("value", "value")} />
      </Field>
      <Field id="stage" label="Stage" error={errors.stage}>
        <select
          id="stage"
          name="stage"
          defaultValue={values.stage}
          aria-invalid={!!errors.stage}
          aria-describedby={described("stage", "stage")}
          className="h-10 max-w-48 rounded-sm border border-rule bg-panel px-3 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {DEAL_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field id="contact" label="Contact" error={errors.contactId}>
        <ContactPicker id="contact" name="contactId" contacts={contacts} defaultId={values.contactId}
          invalid={!!errors.contactId} describedBy={described("contactId", "contact")} />
      </Field>
      <Field id="company" label="Company" error={errors.companyId}>
        <CompanyPicker id="company" name="companyId" companies={companies} defaultId={values.companyId}
          invalid={!!errors.companyId} describedBy={described("companyId", "company")} />
      </Field>
      <Field id="expectedClose" label="Expected close" error={errors.expectedClose}>
        <Input id="expectedClose" name="expectedClose" type="date" defaultValue={values.expectedClose} className="max-w-48"
          aria-invalid={!!errors.expectedClose} aria-describedby={described("expectedClose", "expectedClose")} />
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
