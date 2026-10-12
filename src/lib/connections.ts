// Connected agents (I9). A connection is Better-Auth's consent row: one agent, allowed by one person. The access token
// it leads to is a JWT that /mcp checks by its signature alone, so /mcp also asks isStillConnected() on every request;
// that is what makes Disconnect take effect at once rather than when the token runs out an hour later.
import { and, desc, eq, sql } from "drizzle-orm";
import { WRITE_SCOPE, type AgentAccess } from "@/lib/agent-access";
import { UNNAMED_AGENT } from "@/lib/agents";
import type { Db } from "@/lib/db/client";
import { agentLastUse, oauthAccessToken, oauthClient, oauthConsent, oauthRefreshToken, user } from "@/lib/db/schema";

export type Connection = {
  clientId: string; userId: string; agentName: string; person: string; access: AgentAccess;
  connectedAt: Date | null; lastUsedAt: Date | null;
};

export function accessFrom(scopes: readonly string[]): AgentAccess {
  return scopes.includes(WRITE_SCOPE) ? "change" : "read";
}

// A token counts only if it was issued once the consent existed, so one from before a disconnect stays refused after
// the agent is allowed again. `issuedAt` is the token's iat, in whole seconds; Better-Auth stores the consent's time
// to the second too. A consent with no time (none written by 1.7.5) is taken at its word.
export function consentCovers(consentedAt: Date | null, issuedAt: number): boolean {
  return consentedAt === null || Math.floor(consentedAt.getTime() / 1000) <= issuedAt;
}

// Every connection, newest first. One row per agent and person, even if Better-Auth kept more than one consent.
export async function listConnections(db: Db): Promise<Connection[]> {
  const rows = await db.selectDistinctOn([oauthConsent.clientId, oauthConsent.userId], {
    clientId: oauthConsent.clientId, userId: oauthConsent.userId, agentName: oauthClient.name, person: user.name,
    scopes: oauthConsent.scopes, connectedAt: oauthConsent.createdAt, lastUsedAt: agentLastUse.usedAt,
  })
    .from(oauthConsent)
    .innerJoin(oauthClient, eq(oauthConsent.clientId, oauthClient.clientId))
    .innerJoin(user, eq(oauthConsent.userId, user.id))
    .leftJoin(agentLastUse, and(eq(agentLastUse.clientId, oauthConsent.clientId), eq(agentLastUse.userId, oauthConsent.userId)))
    .orderBy(oauthConsent.clientId, oauthConsent.userId, desc(sql`coalesce(${oauthConsent.updatedAt}, ${oauthConsent.createdAt})`));
  return rows
    .map(({ scopes, userId, agentName, ...r }) => ({
      ...r, userId: userId!, agentName: agentName?.trim() || UNNAMED_AGENT, access: accessFrom(scopes),
    }))
    .sort((a, b) => (b.connectedAt?.getTime() ?? 0) - (a.connectedAt?.getTime() ?? 0));
}

// Whether the agent may still act for this person with a token issued at `issuedAt`.
export async function isStillConnected(db: Db, clientId: string, userId: string, issuedAt: number): Promise<boolean> {
  const consents = await db.select({ createdAt: oauthConsent.createdAt }).from(oauthConsent)
    .where(and(eq(oauthConsent.clientId, clientId), eq(oauthConsent.userId, userId)));
  return consents.some((c) => consentCovers(c.createdAt, issuedAt));
}

export async function noteAgentUse(db: Db, clientId: string, userId: string, at = new Date()): Promise<void> {
  await db.insert(agentLastUse).values({ clientId, userId, usedAt: at })
    .onConflictDoUpdate({ target: [agentLastUse.clientId, agentLastUse.userId], set: { usedAt: at } });
}

// Withdraws the consent and every token the agent holds for this person. The agent stays registered, so it only has
// to ask again on /consent. False when there was nothing to disconnect.
export async function disconnectAgent(db: Db, clientId: string, userId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const gone = await tx.delete(oauthConsent)
      .where(and(eq(oauthConsent.clientId, clientId), eq(oauthConsent.userId, userId)))
      .returning({ id: oauthConsent.id });
    await tx.delete(oauthAccessToken).where(and(eq(oauthAccessToken.clientId, clientId), eq(oauthAccessToken.userId, userId)));
    await tx.delete(oauthRefreshToken).where(and(eq(oauthRefreshToken.clientId, clientId), eq(oauthRefreshToken.userId, userId)));
    await tx.delete(agentLastUse).where(and(eq(agentLastUse.clientId, clientId), eq(agentLastUse.userId, userId)));
    return gone.length > 0;
  });
}
