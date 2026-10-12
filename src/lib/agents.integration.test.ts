import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/test/db";
import { registerAgent, testAuth, type TestAuth } from "@/test/agent";
import type { Db } from "@/lib/db/client";
import { oauthClient } from "@/lib/db/schema";
import { agentName, UNNAMED_AGENT } from "./agents";

let t: { db: Db; close(): Promise<void> };
let auth: TestAuth;
beforeEach(async () => { t = await createTestDb(); auth = testAuth(t.db); });
afterEach(async () => { vi.unstubAllGlobals(); await t.close(); });

describe("agentName", () => {
  it("is the name the agent registered with", async () => {
    const clientId = await registerAgent(auth, "Claude");
    expect(await agentName(t.db, clientId)).toBe("Claude");
  });

  it("calls an agent that gave no name 'An agent'", async () => {
    const clientId = await registerAgent(auth, null);
    expect(await agentName(t.db, clientId)).toBe(UNNAMED_AGENT);
  });

  it("is null for an unknown or switched-off agent", async () => {
    expect(await agentName(t.db, "no-such-agent")).toBeNull();
    const clientId = await registerAgent(auth);
    await t.db.update(oauthClient).set({ disabled: true }).where(eq(oauthClient.clientId, clientId));
    expect(await agentName(t.db, clientId)).toBeNull();
  });
});
