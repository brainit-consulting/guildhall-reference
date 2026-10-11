"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type State = "idle" | "copied" | "failed";

export function CopyAddress({ url }: { url: string }) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy() {
    if (timer.current) clearTimeout(timer.current);
    try {
      // clipboard is missing outside a secure context, and the browser may refuse; both get the same sentence
      await navigator.clipboard.writeText(url);
      setState("copied");
      timer.current = setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <a href={url} className="min-w-0 break-all text-accent underline underline-offset-4">{url}</a>
        <Button type="button" variant="secondary" size="sm" onClick={copy} className="w-20 shrink-0">
          {/* the label itself is the live region, so "Copied" is read out as it appears */}
          <span aria-live="polite">{state === "copied" ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      {state === "failed" && (
        <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">
          Couldn&apos;t copy. Select the address and copy it.
        </p>
      )}
    </div>
  );
}
