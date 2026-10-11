"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cleanSearch, listHref, MAX_SEARCH, type SearchParams } from "@/lib/list-view";

const PAUSE_MS = 300;

// A list's Search box. It is a GET form, so Enter searches even before the page's script has loaded; once loaded it
// also searches by itself after a short pause in typing, replacing the history entry rather than adding one per key.
// The page passes its own path and parameters, so nothing here reads the address and every other parameter is kept.
export function SearchBox({ path, params, q }: { path: string; params: SearchParams; q: string }) {
  const router = useRouter();
  const [value, setValue] = useState(q);
  // The search this box last sent, and the `q` it last saw. When `q` changes to something it didn't send (Clear
  // search, Back), the box shows it; when it is the box's own search arriving, what is typed since is kept.
  const [sent, setSent] = useState(q);
  const [seen, setSeen] = useState(q);
  if (q !== seen) {
    setSeen(q);
    if (q !== sent) {
      setValue(q);
      setSent(q);
    }
  }

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function search(text: string) {
    clearTimeout(timer.current);
    const next = cleanSearch(text);
    if (next === sent) return;
    setSent(next);
    router.replace(listHref(path, params, { q: next || null }), { scroll: false });
  }

  return (
    <form role="search" action={path} method="get" className="flex max-w-sm flex-col gap-2"
      onSubmit={(e) => { e.preventDefault(); search(value); }}>
      <Label htmlFor="list-search">Search</Label>
      <Input id="list-search" name="q" type="search" value={value} maxLength={MAX_SEARCH} autoComplete="off"
        onChange={(e) => {
          const text = e.target.value;
          setValue(text);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => search(text), PAUSE_MS);
        }} />
      {/* Before the script loads, Enter submits the form natively; these keep the sort and any other parameter. */}
      {Object.entries(params).flatMap(([key, v]) =>
        key === "q" || v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((one, i) => (
          <input key={`${key}-${i}`} type="hidden" name={key} value={one} />
        )))}
    </form>
  );
}
