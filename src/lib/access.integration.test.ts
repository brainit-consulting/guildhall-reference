import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isAPIError } from "better-auth/api";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { user } from "@/lib/db/schema";
import { addAllowedEmail, listAllowedEmails, removeAllowedEmail, roleForNewAccount, signUpGate } from "./access";

let t: { db: Db; close(): Promise<void> };
beforeEach(async () => { t = await createTestDb(); });
afterEach(() => t.close());

let n = 0;
async function addAccount(db: Db, email: string, role = "member") {
  n += 1;
  await db.insert(user).values({ id: `u${n}`, name: "Someone", email, role });
}

describe("the owner rule", () => {
  it("makes the first account the owner", async () => {
    expect(await roleForNewAccount(t.db, "margery@lynn.example")).toBe("owner");
  });

  it("closes sign-up to unlisted emails once someone has an account", async () => {
    await addAccount(t.db, "margery@lynn.example", "owner");
    expect(await roleForNewAccount(t.db, "stranger@example.com")).toBeNull();
  });

  it("lets an allowed email in as a member, whatever its case or spaces", async () => {
    await addAccount(t.db, "margery@lynn.example", "owner");
    await addAllowedEmail(t.db, "Wat@Lynn.example");
    expect(await roleForNewAccount(t.db, "  wat@lynn.EXAMPLE ")).toBe("member");
  });

  it("lets the database hold only one owner", async () => {
    await addAccount(t.db, "margery@lynn.example", "owner");
    await expect(addAccount(t.db, "second@lynn.example", "owner")).rejects.toThrow();
    await addAccount(t.db, "member@lynn.example", "member");
    await addAccount(t.db, "member2@lynn.example", "member");
  });
});

describe("the sign-up gate", () => {
  it("sets the role on the account Better-Auth is about to create", async () => {
    const gate = signUpGate(t.db);
    const result = await gate({ email: "margery@lynn.example", name: "Margery", role: "member" });
    expect(result.data).toEqual({ email: "margery@lynn.example", name: "Margery", role: "owner" });
  });

  it("refuses with SIGN_UP_CLOSED and the message the form shows", async () => {
    await addAccount(t.db, "margery@lynn.example", "owner");
    const err = await signUpGate(t.db)({ email: "stranger@example.com" }).catch((e: unknown) => e);
    expect(isAPIError(err)).toBe(true);
    expect(err).toMatchObject({ body: { code: "SIGN_UP_CLOSED", message: "Ask the owner to add your email in Settings." } });
  });
});

describe("the allowed list", () => {
  it("adds, lists in order and removes emails", async () => {
    expect(await addAllowedEmail(t.db, "wat@lynn.example")).toEqual({ error: null });
    expect(await addAllowedEmail(t.db, " Alice@Lynn.example ")).toEqual({ error: null });
    const list = await listAllowedEmails(t.db);
    expect(list.map((a) => a.email)).toEqual(["alice@lynn.example", "wat@lynn.example"]);

    await removeAllowedEmail(t.db, list[0].id);
    expect((await listAllowedEmails(t.db)).map((a) => a.email)).toEqual(["wat@lynn.example"]);
  });

  it("explains an empty, malformed or repeated email", async () => {
    expect(await addAllowedEmail(t.db, "   ")).toEqual({ error: "Enter an email address." });
    expect((await addAllowedEmail(t.db, "wat-at-lynn")).error).toMatch(/doesn't look like an email/);
    await addAllowedEmail(t.db, "wat@lynn.example");
    expect(await addAllowedEmail(t.db, "WAT@lynn.example")).toEqual({ error: "That email is already on the list." });
    expect(await listAllowedEmails(t.db)).toHaveLength(1);
  });

  it("ignores a remove for something that isn't a list entry", async () => {
    await addAllowedEmail(t.db, "wat@lynn.example");
    await removeAllowedEmail(t.db, "not-an-id");
    await removeAllowedEmail(t.db, "00000000-0000-4000-8000-000000000000");
    expect(await listAllowedEmails(t.db)).toHaveLength(1);
  });

  it("closes sign-up again once an email is removed", async () => {
    await addAccount(t.db, "margery@lynn.example", "owner");
    await addAllowedEmail(t.db, "wat@lynn.example");
    const [entry] = await listAllowedEmails(t.db);
    await removeAllowedEmail(t.db, entry.id);
    expect(await roleForNewAccount(t.db, "wat@lynn.example")).toBeNull();
  });
});
