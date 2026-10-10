import { describe, expect, it } from "vitest";
import { db, localClient } from "./client";
import { env } from "@/lib/env";

describe("localClient", () => {
  it("returns the same PGlite for the same folder, so a reload never opens a second one", () => {
    expect(localClient("memory://a")).toBe(localClient("memory://a"));
  });
});

describe("db", () => {
  it("does not open the database folder on import", () => {
    // Next imports page modules in build and worker processes; opening there corrupts the folder the server holds
    expect(db).toBeDefined();
    const open = (globalThis as { guildhallPglite?: Map<string, unknown> }).guildhallPglite;
    expect(open?.has(env.dataDir) ?? false).toBe(false);
  });
});
