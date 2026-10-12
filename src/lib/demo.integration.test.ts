// The real Better-Auth endpoints, through its HTTP handler, on a fresh database.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { allowedEmail, user } from "@/lib/db/schema";
import { authOptions } from "@/lib/auth/server";
import { env } from "@/lib/env";

const DEMO = "demo@hollowoak.example";
const OWNER = "margery@hollowoak.example";
const PASSWORD = "showcase password";

let t: { db: Db; close(): Promise<void> };
beforeEach(async () => { t = await createTestDb(); });
afterEach(() => t.close());

type Auth = { handler(request: Request): Promise<Response> };

function call(auth: Auth, path: string, body: unknown, cookie?: string) {
  return auth.handler(new Request(`${env.authUrl}/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: env.authUrl, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  }));
}

// Signs the owner and the demo account up, and returns a function that signs one in and gives its cookie.
async function setUp(demoEmail: string | null) {
  const auth = betterAuth(authOptions(t.db, demoEmail));
  await t.db.insert(allowedEmail).values({ email: DEMO });
  for (const [name, email] of [["Margery", OWNER], ["Demo", DEMO]])
    expect((await call(auth, "/sign-up/email", { name, email, password: PASSWORD })).status).toBe(200);
  async function signIn(email: string, password = PASSWORD) {
    const res = await call(auth, "/sign-in/email", { email, password });
    expect(res.status).toBe(200);
    return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  }
  return { auth, signIn };
}

const findUser = async (email: string) => (await t.db.select().from(user).where(eq(user.email, email)))[0];

// Guildhall leaves Better-Auth's change-email and delete-user switched off, so for any account but the demo they answer
// as they always have: change-email 400, delete-user 404. Neither is the demo refusal, and nothing changes.
async function expectSwitchedOff(auth: Auth, cookie: string, email: string) {
  const changeEmail = await call(auth, "/change-email", { newEmail: "someone-else@example.com" }, cookie);
  expect(changeEmail.status).toBe(400);
  expect(await changeEmail.json()).toMatchObject({ code: "CHANGE_EMAIL_DISABLED" });
  expect((await call(auth, "/delete-user", { password: "a new password" }, cookie)).status).toBe(404);
  expect(await findUser(email)).toBeDefined();
}

const REQUESTS = [
  ["/change-password", { currentPassword: PASSWORD, newPassword: "locked everyone out", revokeOtherSessions: true }],
  ["/change-email", { newEmail: "mine-now@example.com" }],
  ["/update-user", { name: "Not the demo" }],
  ["/delete-user", { password: PASSWORD }],
] as const;

describe("with DEMO_EMAIL set", () => {
  it("refuses the demo account's four requests, and nothing changes", async () => {
    const { auth, signIn } = await setUp(DEMO);
    const cookie = await signIn(DEMO);
    const before = await findUser(DEMO);
    for (const [path, body] of REQUESTS) {
      const res = await call(auth, path, body, cookie);
      expect(res.status, path).toBe(403);
      expect(await res.json(), path).toMatchObject({ code: "DEMO_LOCKED", message: "The demo account can't be changed." });
    }
    expect(await findUser(DEMO)).toEqual(before);
    await signIn(DEMO); // the password still works
  });

  it("still lets the demo account sign in and out", async () => {
    const { auth, signIn } = await setUp(DEMO);
    const cookie = await signIn(DEMO);
    expect((await call(auth, "/sign-out", {}, cookie)).status).toBe(200);
    await signIn(DEMO);
  });

  it("lets another account change its name and password as before", async () => {
    const { auth, signIn } = await setUp(DEMO);
    const cookie = await signIn(OWNER);
    expect((await call(auth, "/update-user", { name: "Margery Kempe" }, cookie)).status).toBe(200);
    expect((await findUser(OWNER)).name).toBe("Margery Kempe");
    expect((await call(auth, "/change-password", { currentPassword: PASSWORD, newPassword: "a new password" }, cookie)).status).toBe(200);
    await expectSwitchedOff(auth, await signIn(OWNER, "a new password"), OWNER);
  });
});

describe("without DEMO_EMAIL", () => {
  it("lets the account with the demo email change its name and password like anyone", async () => {
    const { auth, signIn } = await setUp(null);
    const cookie = await signIn(DEMO);
    expect((await call(auth, "/update-user", { name: "Renamed" }, cookie)).status).toBe(200);
    expect((await findUser(DEMO)).name).toBe("Renamed");
    expect((await call(auth, "/change-password", { currentPassword: PASSWORD, newPassword: "a new password" }, cookie)).status).toBe(200);
    await expectSwitchedOff(auth, await signIn(DEMO, "a new password"), DEMO);
  });
});
