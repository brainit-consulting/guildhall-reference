import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { listHref, nextDir, sortChanges, type ListView, type SearchParams } from "@/lib/list-view";
import { cn } from "@/lib/utils";

// A column heading that sorts its table: a link, so Tab reaches it and Enter sorts. A to Z first, then Z to A. The
// sorted column shows an arrow and carries aria-sort; the search and any other parameter are kept.
export function SortHeading({ path, params, view, column, label, className }: {
  path: string; params: SearchParams; view: ListView; column: string; label: string; className?: string;
}) {
  const on = view.sort === column;
  const Arrow = view.dir === "desc" ? ArrowDown : ArrowUp;
  return (
    <th scope="col" aria-sort={on ? (view.dir === "desc" ? "descending" : "ascending") : undefined}
      className={cn("px-3 py-2 font-medium", className)}>
      <Link href={listHref(path, params, sortChanges(column, nextDir(view, column)))} scroll={false}
        className={cn("inline-flex items-center gap-1 underline-offset-4 hover:text-ink hover:underline", on && "text-ink")}>
        {label}
        {on && <Arrow aria-hidden className="size-3.5 text-accent" />}
      </Link>
    </th>
  );
}
