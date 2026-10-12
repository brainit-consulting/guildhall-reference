"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { grantedScopes, type AgentAccess } from "@/lib/agent-access";

const CHOICES: { value: AgentAccess; label: string; hint: string }[] = [
  { value: "read", label: "Read only", hint: "Look up contacts, companies, deals and tasks. Change nothing." },
  { value: "change", label: "Read and change", hint: "Also add contacts, log activities and move deals." },
];

// The owner's answer goes to Better-Auth with the page's signed request, which sends the agent back with a code or a
// refusal. The scopes sent are what the agent asked for, less guildhall:write unless the owner chose Read and change.
export function ConsentForm({ agent, canChange, requested }: { agent: string; canChange: boolean; requested: string }) {
  const [access, setAccess] = useState<AgentAccess>("read");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function answer(accept: boolean) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/oauth2/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accept,
          ...(accept ? { scope: grantedScopes(requested, access) } : {}),
          oauth_query: window.location.search.slice(1),
        }),
      });
      const data = res.ok ? await res.json() : null;
      const next = data?.url ?? data?.redirect_uri;
      if (typeof next !== "string") throw new Error("no address to go back to");
      window.location.assign(next);
    } catch {
      setError(`That didn't work. Go back to ${agent} and connect it again.`);
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => { event.preventDefault(); answer(true); }}
      className="mt-6 flex flex-col gap-5 border-t border-rule pt-6"
    >
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-medium text-ink">What may {agent} do?</legend>
        {CHOICES.map((choice) => {
          const disabled = choice.value === "change" && !canChange;
          return (
            <label key={choice.value} className={`flex gap-3 ${disabled ? "opacity-60" : ""}`}>
              <input
                type="radio"
                name="access"
                value={choice.value}
                checked={access === choice.value}
                disabled={disabled}
                onChange={() => setAccess(choice.value)}
                className="mt-0.5 size-4 shrink-0 accent-accent"
              />
              <span className="flex flex-col gap-1">
                <span className="text-ink">{choice.label}</span>
                <span className="text-sm text-muted">
                  {disabled ? `${agent} asked only to look things up.` : choice.hint}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {error && <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>Allow</Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => answer(false)}>Don&apos;t allow</Button>
      </div>
    </form>
  );
}
