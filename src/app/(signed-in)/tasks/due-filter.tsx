"use client";

import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { listHref, type SearchParams } from "@/lib/list-view";
import type { TaskDue } from "@/lib/tasks";

const OPTIONS: { value: TaskDue | ""; label: string }[] = [
  { value: "", label: "Any day" }, { value: "overdue", label: "Overdue" }, { value: "today", label: "Due today" },
];

// `due=overdue` or `due=today`, where Home's counts link to. A GET form carrying every other parameter, like the Deals
// Stage filter: picking shows it at once, and without the script the Show button sends the form.
export function DueFilter({ params, due }: { params: SearchParams; due: TaskDue | null }) {
  const router = useRouter();
  const show = (value: string) => router.push(listHref("/tasks", params, { due: value || null }), { scroll: false });
  return (
    <form action="/tasks" method="get" className="flex items-center gap-3"
      onSubmit={(e) => { e.preventDefault(); show(new FormData(e.currentTarget).get("due") as string); }}>
      <Label htmlFor="due-filter">Due</Label>
      <select id="due-filter" name="due" value={due ?? ""} onChange={(e) => show(e.target.value)}
        className="h-10 rounded-sm border border-rule bg-panel px-3 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        {OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <noscript>
        <button type="submit" className="h-10 rounded-sm border border-rule px-3 text-sm text-ink">Show</button>
      </noscript>
      {Object.entries(params).flatMap(([key, v]) =>
        key === "due" || v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((one, i) => (
          <input key={`${key}-${i}`} type="hidden" name={key} value={one} />
        )))}
    </form>
  );
}
