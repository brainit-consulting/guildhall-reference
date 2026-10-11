"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMPTY_ENQUIRY } from "@/lib/enquiries";
import { sendEnquiryAction } from "./actions";

// One column, labels above fields, the button at the bottom left (DESIGN.md). Autocomplete is on here, unlike the
// records' forms: a stranger filling this in is helped by their browser.
export function EnquiryForm() {
  const [state, formAction, pending] = useActionState(sendEnquiryAction,
    { errors: {}, values: EMPTY_ENQUIRY, attempt: 0, thanks: null });
  const { errors, values } = state;

  // Built from the action's result, never the address, so nobody can make a link that puts words on this page.
  if (state.thanks) {
    return <p role="status" className="mt-8 text-lg text-ink wrap-anywhere">{state.thanks}</p>;
  }

  const describe = (field: keyof typeof errors) =>
    ({ "aria-invalid": !!errors[field], "aria-describedby": errors[field] ? `${field}-error` : undefined });

  return (
    <form key={state.attempt} action={formAction} noValidate className="relative mt-8 flex flex-col gap-5">
      <Field id="name" label="Name" error={errors.name}>
        <Input id="name" name="name" defaultValue={values.name} autoComplete="name" {...describe("name")} />
      </Field>
      <Field id="email" label="Email" error={errors.email}>
        <Input id="email" name="email" type="email" defaultValue={values.email} autoComplete="email" {...describe("email")} />
      </Field>
      <Field id="phone" label="Phone (optional)" error={errors.phone}>
        <Input id="phone" name="phone" type="tel" defaultValue={values.phone} autoComplete="tel" {...describe("phone")} />
      </Field>
      <Field id="company" label="Company (optional)" error={errors.company}>
        <Input id="company" name="company" defaultValue={values.company} autoComplete="organization" {...describe("company")} />
      </Field>
      <Field id="message" label="What do you need?" error={errors.message}>
        <textarea
          id="message"
          name="message"
          rows={6}
          defaultValue={values.message}
          {...describe("message")}
          className="w-full rounded-sm border border-rule bg-panel px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </Field>

      {/* Only a bot fills this in. Off-screen rather than hidden or display:none, which bots know to skip; out of the
          tab order and the accessibility tree, so people never meet it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden">
        <label htmlFor="website">Leave this empty</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div>
        <Button type="submit" disabled={pending}>Send</Button>
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
