// Agents that have registered to sign in (I5). Better-Auth writes the oauth_client rows; Guildhall only reads the
// name an agent gave itself, to say on /consent who is asking.
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { oauthClient } from "@/lib/db/schema";

export const UNNAMED_AGENT = "An agent";

// null when no agent registered with that client ID (or it has been switched off).
export async function agentName(db: Db, clientId: string): Promise<string | null> {
  const [found] = await db.select({ name: oauthClient.name, disabled: oauthClient.disabled })
    .from(oauthClient).where(eq(oauthClient.clientId, clientId));
  if (!found || found.disabled) return null;
  return found.name?.trim() || UNNAMED_AGENT;
}
