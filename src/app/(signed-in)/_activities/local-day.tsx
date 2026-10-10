"use client";

import { useSyncExternalStore } from "react";
import { formatDay } from "@/lib/dates";

const noChange = () => () => {};
const pad = (n: number) => String(n).padStart(2, "0");

// The day a moment fell on where the reader is: the server can't know their time zone, so it renders the UTC day and
// the browser puts in its own once hydrated (useSyncExternalStore's server snapshot avoids a hydration mismatch).
export function LocalDay({ at }: { at: string }) {
  const day = useSyncExternalStore(
    noChange,
    () => { const d = new Date(at); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; },
    () => at.slice(0, 10),
  );
  return <time dateTime={at}>{formatDay(day)}</time>;
}
