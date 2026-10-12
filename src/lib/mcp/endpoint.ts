// /mcp (I5): Streamable HTTP, stateless, behind agent sign-in. Better-Auth checks the bearer token (signature, issuer,
// that it was issued for this address, expiry, guildhall:read) and answers 401 with a WWW-Authenticate header naming
// the protected-resource address when there is none, so an agent knows where to sign in. Each request then runs as the
// person who connected the agent.
import { requireMcpAuth } from "@better-auth/mcp";
import { createMcpHandler, type AuthInfo, type McpHttpHandler } from "@modelcontextprotocol/server";
import { eq } from "drizzle-orm";
import { READ_SCOPE, WRITE_SCOPE } from "@/lib/agent-access";
import type { LoggedAgent } from "@/lib/agent-log";
import { agentName, UNNAMED_AGENT } from "@/lib/agents";
import type { Db } from "@/lib/db/client";
import { user } from "@/lib/db/schema";
import { createGuildhallServer, type Person } from "./server";

export type McpEndpoint = (request: Request) => Promise<Response>;
type AgentAuth = Parameters<typeof requireMcpAuth>[0];

// The protected-resource address for a resource, as Better-Auth serves it (RFC 9728).
export function resourceMetadataUrl(resource: string): string {
  const url = new URL(resource);
  return `${url.origin}/.well-known/oauth-protected-resource${url.pathname}`;
}

// A token whose person no longer exists signs nobody in.
function signedOut(resource: string): Response {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Sign in again: the person this agent signed in as is gone." }, id: null },
    { status: 401, headers: { "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadataUrl(resource)}"` } },
  );
}

// `db` is a function so a refused request never opens the database.
export function mcpEndpoint(opts: { auth: AgentAuth; resource: string; db: () => Db }): McpEndpoint {
  let handler: McpHttpHandler | undefined;
  return requireMcpAuth(opts.auth, async (request, claims) => {
    const [person] = typeof claims.sub === "string"
      ? await opts.db().select({ id: user.id, name: user.name }).from(user).where(eq(user.id, claims.sub))
      : [];
    if (!person) return signedOut(opts.resource);
    const clientId = typeof claims.azp === "string" ? claims.azp : "";
    // the name it registered with, for the agent log
    const client: LoggedAgent = { clientId, name: (clientId && await agentName(opts.db(), clientId)) || UNNAMED_AGENT };
    const authInfo: AuthInfo = {
      token: "", // never handed on: the tools don't need it
      clientId,
      scopes: typeof claims.scope === "string" ? claims.scope.split(" ") : [],
      expiresAt: claims.exp,
      extra: { person, client },
    };
    handler ??= createMcpHandler(({ authInfo }) => createGuildhallServer(
      opts.db(), authInfo?.extra?.person as Person, authInfo?.extra?.client as LoggedAgent,
      authInfo?.scopes.includes(WRITE_SCOPE) ?? false,
    ));
    return handler.fetch(request, { authInfo });
  }, {
    resource: opts.resource,
    requiredScopes: [READ_SCOPE],
    // Agents ask for what the 401 names. Naming both lets the owner, not the agent, choose on /consent.
    challengeScopes: [READ_SCOPE, WRITE_SCOPE],
  });
}
