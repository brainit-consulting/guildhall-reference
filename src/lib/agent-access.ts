// What an agent may do in Guildhall (I5). The owner picks Read only or Read and change on /consent, whatever the agent
// asked for; the token then carries guildhall:write only for Read and change. No env or database here: the consent
// page imports it in the browser.
export const READ_SCOPE = "guildhall:read";
export const WRITE_SCOPE = "guildhall:write";

// Everything an agent may ask for: Guildhall's two, plus sign-in's own (who you are, and staying signed in).
export const AGENT_SCOPES = ["openid", "profile", "email", "offline_access", READ_SCOPE, WRITE_SCOPE];

export type AgentAccess = "read" | "change";

function split(scope: string | null | undefined): string[] {
  return (scope ?? "").split(" ").filter(Boolean);
}

// The scopes to grant: those the agent asked for, without guildhall:write unless the owner chose Read and change.
// Better-Auth refuses a scope the agent didn't ask for, so this only ever narrows the request.
export function grantedScopes(requested: string | null | undefined, access: AgentAccess): string {
  return split(requested).filter((s) => access === "change" || s !== WRITE_SCOPE).join(" ");
}

// Read and change can only be granted if the agent asked for guildhall:write.
export function asksToChange(requested: string | null | undefined): boolean {
  return split(requested).includes(WRITE_SCOPE);
}
