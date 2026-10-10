"use client";

import { useSyncExternalStore } from "react";
import { daysAgo, formatDay } from "@/lib/dates";

const noChange = () => () => {};
const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// "3 days ago", counted in the reader's own calendar days. The server can't know their time zone, so it renders the
// UTC days as of its own `now` (the same on the server and during hydration), and the browser puts in its own after.
export function DaysAgo({ at, now }: { at: string; now: string }) {
  const text = useSyncExternalStore(
    noChange,
    () => daysAgo(localDay(new Date(at)), localDay(new Date())),
    () => daysAgo(at.slice(0, 10), now.slice(0, 10)),
  );
  const day = useSyncExternalStore(noChange, () => localDay(new Date(at)), () => at.slice(0, 10));
  return <time dateTime={at} title={formatDay(day)}>{text}</time>;
}
