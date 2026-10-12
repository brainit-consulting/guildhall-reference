"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTaxRate, invoiceTotals, parseQuantity } from "@/lib/invoice-totals";
import type { InvoiceInput, LineErrors, LineInput } from "@/lib/invoices";
import { CURRENCY, formatMoney, parseMoney } from "@/lib/money";
import type { InvoiceFormState } from "./actions";

type Props = {
  action: (prev: InvoiceFormState, form: FormData) => Promise<InvoiceFormState>;
  initial: InvoiceInput;
  clients: { id: string; name: string }[];
  projects: { id: string; name: string; clientId: string }[];
  // the rate this invoice charges: the business's for a new one, its own for an edit
  taxRate: string;
  submitLabel: string;
  cancelHref: string;
};

const MAX_LINES = 50; // as checkInvoice; the form stops offering rows there
const EMPTY_LINE: LineInput = { description: "", quantity: "", unitPrice: "" };
const select = "h-10 max-w-full rounded-sm border border-rule bg-panel px-3 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// New and Edit share this form: one column, labels above fields, the button at the bottom left (DESIGN.md). The
// totals underneath follow what is typed, worked out by the same invoiceTotals the invoice page uses.
export function InvoiceForm(props: Props) {
  const [state, formAction, pending] = useActionState(props.action, { errors: {}, values: props.initial, attempt: 0 });
  // remounted on every refused save, so the rows and pickers start again from what was sent
  return <Fields key={state.attempt} {...props} state={state} formAction={formAction} pending={pending} />;
}

function Fields({ clients, projects, taxRate, submitLabel, cancelHref, state, formAction, pending }: Props & {
  state: InvoiceFormState; formAction: (form: FormData) => void; pending: boolean;
}) {
  const { errors, values } = state;
  const [clientId, setClientId] = useState(values.clientId);
  const [projectId, setProjectId] = useState(values.projectId);
  // each row keeps a key of its own, so removing one doesn't shift what is typed into the next
  const [lines, setLines] = useState(() => (values.lines.length > 0 ? values.lines : [EMPTY_LINE]).map((l, key) => ({ ...l, key })));
  const addLine = () => setLines((ls) => [...ls, { ...EMPTY_LINE, key: Math.max(...ls.map((l) => l.key)) + 1 }]);

  const theirs = projects.filter((p) => p.clientId === clientId);
  const described = (field: string) => (errors[field as keyof typeof errors] ? `${field}-error` : undefined);

  function setLine(i: number, field: keyof LineInput, value: string) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [field]: value } : l)));
  }

  // Rows not yet typed in full count as nothing; a row's amount shows once its quantity and price are figures.
  const parsed = lines.map((l) => {
    const q = parseQuantity(l.quantity);
    const p = parseMoney(l.unitPrice);
    return q.value !== null && l.unitPrice.trim() && p.value !== null ? { quantity: q.value, unitPrice: p.value } : null;
  });
  const totals = invoiceTotals(parsed.filter((l) => l !== null), taxRate);
  let n = 0;
  const amounts = parsed.map((l) => (l ? totals.lines[n++] : null));

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {errors.form && <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">{errors.form}</p>}

      <Field id="clientId" label="Client" error={errors.clientId}>
        <select id="clientId" name="clientId" value={clientId} className={select}
          onChange={(e) => {
            setClientId(e.target.value);
            // a project belongs to one client
            if (!projects.some((p) => p.id === projectId && p.clientId === e.target.value)) setProjectId("");
          }}
          aria-invalid={!!errors.clientId} aria-describedby={described("clientId")}>
          <option value="">Pick a client</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field id="projectId" label="Project (optional)" error={errors.projectId}>
        <select id="projectId" name="projectId" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={select}
          aria-invalid={!!errors.projectId} aria-describedby={described("projectId")}>
          <option value="">{!clientId ? "Pick a client first" : theirs.length === 0 ? "This client has no projects" : "No project"}</option>
          {theirs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <div className="flex flex-wrap gap-5">
        <Field id="issueOn" label="Issue date" error={errors.issueOn}>
          <Input id="issueOn" name="issueOn" type="date" defaultValue={values.issueOn} className="w-48"
            aria-invalid={!!errors.issueOn} aria-describedby={described("issueOn")} />
        </Field>
        <Field id="dueOn" label="Due date" error={errors.dueOn}>
          <Input id="dueOn" name="dueOn" type="date" defaultValue={values.dueOn} className="w-48"
            aria-invalid={!!errors.dueOn} aria-describedby={described("dueOn")} />
        </Field>
      </div>

      <fieldset className="mt-2" aria-describedby={errors.lines ? "lines-error" : undefined}>
        <legend className="font-display text-xl text-ink">Lines</legend>
        {/* column heads from 768px; below that each row labels its own fields */}
        <div aria-hidden className="mt-3 hidden gap-3 border-b border-rule pb-2 text-sm text-muted md:grid md:grid-cols-[1fr_6rem_8rem_7rem_5.5rem]">
          <span>Description</span><span className="text-right">Quantity</span><span className="text-right">Unit price ({CURRENCY})</span>
          <span className="text-right">Amount</span><span />
        </div>
        <ol className="border-t border-rule md:border-t-0">
          {lines.map((l, i) => (
            <Line key={l.key} index={i} line={l} amount={amounts[i]} errors={errors.line?.[i]}
              onChange={(field, value) => setLine(i, field, value)}
              onRemove={lines.length > 1 ? () => setLines((ls) => ls.filter((_, j) => j !== i)) : undefined} />
          ))}
        </ol>
        {errors.lines && <p id="lines-error" role="alert" className="mt-3 border-l-2 border-danger pl-3 text-sm text-danger">{errors.lines}</p>}
        {lines.length < MAX_LINES && (
          <Button type="button" variant="secondary" className="mt-3 tap-target" onClick={addLine}>
            Add line
          </Button>
        )}
      </fieldset>

      <dl aria-label="Totals" className="ml-auto w-full max-w-xs border-t border-rule">
        {([["Subtotal", totals.subtotal], [`Tax (${formatTaxRate(taxRate)})`, totals.tax], ["Total", totals.total]] as const).map(([label, value]) => (
          <div key={label} className={`flex justify-between gap-4 border-b border-rule py-2 ${label === "Total" ? "font-medium text-ink" : "text-ink"}`}>
            <dt className={label === "Total" ? "" : "text-muted"}>{label}</dt>
            <dd className="tabular-nums">{formatMoney(value)}</dd>
          </div>
        ))}
      </dl>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>{submitLabel}</Button>
        <Link href={cancelHref} className="tap-target text-sm text-accent underline-offset-4 hover:underline">Cancel</Link>
      </div>
    </form>
  );
}

function Line({ index, line, amount, errors = {}, onChange, onRemove }: {
  index: number; line: LineInput; amount: string | null; errors?: LineErrors;
  onChange: (field: keyof LineInput, value: string) => void; onRemove?: () => void;
}) {
  const id = (field: string) => `line-${index}-${field}`;
  const messages = (["description", "quantity", "unitPrice"] as const).filter((f) => errors[f]);
  const describedBy = (field: keyof LineInput) => (errors[field] ? id(`${field}-error`) : undefined);
  return (
    <li aria-label={`Line ${index + 1}`} className="grid grid-cols-2 gap-3 border-b border-rule py-3 md:grid-cols-[1fr_6rem_8rem_7rem_5.5rem] md:items-start">
      <div className="col-span-2 flex flex-col gap-2 md:col-span-1">
        <Label htmlFor={id("description")} className="md:sr-only">Description</Label>
        <Input id={id("description")} name="description" value={line.description} onChange={(e) => onChange("description", e.target.value)}
          autoComplete="off" aria-invalid={!!errors.description} aria-describedby={describedBy("description")} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={id("quantity")} className="md:sr-only">Quantity</Label>
        <Input id={id("quantity")} name="quantity" inputMode="decimal" value={line.quantity} onChange={(e) => onChange("quantity", e.target.value)}
          autoComplete="off" placeholder="1" className="text-right tabular-nums" aria-invalid={!!errors.quantity} aria-describedby={describedBy("quantity")} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={id("unitPrice")} className="md:sr-only">Unit price ({CURRENCY})</Label>
        <Input id={id("unitPrice")} name="unitPrice" inputMode="decimal" value={line.unitPrice} onChange={(e) => onChange("unitPrice", e.target.value)}
          autoComplete="off" placeholder="85.00" className="text-right tabular-nums" aria-invalid={!!errors.unitPrice} aria-describedby={describedBy("unitPrice")} />
      </div>
      <p className="flex items-center gap-2 text-ink md:h-10 md:justify-end">
        <span className="text-sm text-muted md:sr-only">Amount</span>
        <output aria-label={`Line ${index + 1} amount`} className="tabular-nums">{amount ? formatMoney(amount) : ""}</output>
      </p>
      <div className="flex items-center justify-end md:h-10">
        {onRemove && (
          <Button type="button" variant="ghost" size="sm" className="tap-target text-danger" onClick={onRemove} aria-label={`Remove line ${index + 1}`}>
            Remove
          </Button>
        )}
      </div>
      {messages.length > 0 && (
        <div className="col-span-2 flex flex-col gap-1 md:col-span-5">
          {messages.map((f) => (
            <p key={f} id={id(`${f}-error`)} role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">{errors[f]}</p>
          ))}
        </div>
      )}
    </li>
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
