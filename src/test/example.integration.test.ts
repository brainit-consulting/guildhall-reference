import { afterAll, describe, expect, it } from "vitest";
import { createTestDb } from "./db";
import { user } from "@/lib/db/schema";

describe("the built-in database", async () => {
  const t = await createTestDb();
  afterAll(() => t.close());
  it("has the migrated tables", async () => {
    await t.db.insert(user).values({ id: "u1", name: "Ada", email: "ada@example.com", emailVerified: false,
      createdAt: new Date(), updatedAt: new Date() });
    expect((await t.db.select().from(user)).map((u) => u.role)).toEqual(["member"]);
  });
});
