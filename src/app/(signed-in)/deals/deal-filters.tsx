"use client";

import Form from "next/form";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { DEAL_STAGES, type DealStage } from "@/lib/deal-stages";
import { listHref, type SearchParams } from "@/lib/list-view";
import { cn } from "@/lib/utils";

// The Deals filters, kept in the address beside the search and sort: `stage=Proposal`, `open=1` and `cold=1`. Each is a GET
// form carrying every other parameter, so it works before the script loads and a copied link opens the same view.

// The page's parameters as hidden fields, all but the ones this form sets itself.
function Keep({ params, except }: { params: SearchParams; except: string }) {
  return Object.entries(params).flatMap(([key, v]) =>
    key === except || v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((one, i) => (
      <input key={`${key}-${i}`} type="hidden" name={key} value={one} />
    )));
}

// Picking a stage shows it at once; without the script, the Show button sends the form.
export function StageFilter({ path, params, stage }: { path: string; params: SearchParams; stage: DealStage | null }) {
  const router = useRouter();
  const show = (value: string) => router.push(listHref(path, params, { stage: value || null }), { scroll: false });
  return (
    <form action={path} method="get" className="flex flex-col gap-2"
      onSubmit={(e) => { e.preventDefault(); show(new FormData(e.currentTarget).get("stage") as string); }}>
      <Label htmlFor="deal-stage">Stage</Label>
      <div className="flex gap-2">
        <select id="deal-stage" name="stage" value={stage ?? ""} onChange={(e) => show(e.target.value)}
          className="h-10 rounded-sm border border-rule bg-panel px-3 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <option value="">Any stage</option>
          {DEAL_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <noscript>
          <button type="submit" className="h-10 rounded-sm border border-rule px-3 text-sm text-ink">Show</button>
        </noscript>
      </div>
      <Keep params={params} except="stage" />
    </form>
  );
}

type Filter = { path: string; params: SearchParams; on: boolean };

export function OpenOnly(props: Filter) {
  return <Switch {...props} name="open" label="Open only" />;
}

export function GoingCold(props: Filter) {
  return <Switch {...props} name="cold" label="Going cold" />;
}

// A switch like "Show done" on /tasks: one button in a GET form, so Space or Enter flips it and a reload keeps it.
function Switch({ path, params, on, name, label }: Filter & { name: string; label: string }) {
  return (
    <Form action={path} scroll={false}>
      <Keep params={params} except={name} />
      {!on && <input type="hidden" name={name} value="1" />}
      <button type="submit" role="switch" aria-checked={on}
        className="inline-flex h-10 cursor-pointer items-center gap-3 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <span aria-hidden className={cn("flex h-5 w-9 items-center rounded-sm border p-0.5", on ? "border-accent bg-accent" : "border-rule bg-panel")}>
          <span className={cn("size-3.5 rounded-[1px] transition-transform", on ? "translate-x-4 bg-paper" : "bg-muted")} />
        </span>
        {label}
      </button>
    </Form>
  );
}
