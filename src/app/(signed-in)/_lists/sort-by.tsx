import { Check } from "lucide-react";
import Link from "next/link";
import { listHref, sortChanges, type ListView, type SearchParams, type SortDir } from "@/lib/list-view";
import { cn } from "@/lib/utils";

type Choice = { sort: string | null; dir: SortDir; label: string };

// Under 768px a list has no headings, so this offers each column both ways. A disclosure of links: Tab and Enter
// open it and pick, it works before the script loads, and the address changes just as a heading's click would.
// `defaultLabel` names the list's order with no sort chosen, so it can be shown and picked again. A column whose values
// aren't words names its own directions ("Value, lowest first"); otherwise they read "A to Z" and "Z to A".
export function SortBy({ path, params, view, columns, defaultLabel, className }: {
  path: string; params: SearchParams; view: ListView; columns: { key: string; label: string; asc?: string; desc?: string }[]; defaultLabel: string;
  className?: string;
}) {
  const choices: Choice[] = [
    { sort: null, dir: "asc", label: defaultLabel },
    ...columns.flatMap(({ key, label, asc = "A to Z", desc = "Z to A" }): Choice[] => [
      { sort: key, dir: "asc", label: `${label}, ${asc}` },
      { sort: key, dir: "desc", label: `${label}, ${desc}` },
    ]),
  ];
  const isCurrent = (c: Choice) => c.sort === view.sort && (c.sort === null || c.dir === view.dir);
  const current = choices.find(isCurrent) ?? choices[0];
  return (
    // keyed on the current sort so it starts closed again after a pick
    <details key={`${view.sort}-${view.dir}`} className={className}>
      <summary className="inline-flex h-10 pointer-coarse:h-[44px] cursor-pointer items-center gap-2 rounded-sm border border-rule bg-panel px-3 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <span className="text-muted">Sort by:</span> {current.label}
      </summary>
      <ul aria-label="Sort by" className="mt-1 border-y border-rule">
        {choices.map((c) => (
          <li key={c.label} className="border-b border-rule last:border-b-0">
            <Link href={listHref(path, params, sortChanges(c.sort, c.dir))} scroll={false}
              aria-current={isCurrent(c) ? "true" : undefined}
              className={cn("flex items-center justify-between py-2 pointer-coarse:min-h-[44px] text-sm underline-offset-4 hover:underline",
                isCurrent(c) ? "text-ink" : "text-accent")}>
              {c.label}
              {isCurrent(c) && <Check aria-hidden className="size-4 text-accent" />}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
