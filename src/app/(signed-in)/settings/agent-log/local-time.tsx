"use client";

import { useSyncExternalStore } from "react";
import { formatDay } from "@/lib/dates";

const noChange = () => () => {};
const pad = (n: number) => String(n).padStart(2, "0");

// "12 Oct 2026, 14:05" where the reader is. The server can't know their time zone, so it renders UTC, saying so, and
// the browser puts in its own once hydrated (as LocalDay does).
export function LocalTime({ at }: { at: string }) {
  const text = useSyncExternalStore(
    noChange,
    () => {
      const d = new Date(at);
      return `${formatDay(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },
    () => `${formatDay(at.slice(0, 10))}, ${at.slice(11, 16)} UTC`,
  );
  return <time dateTime={at}>{text}</time>;
}
