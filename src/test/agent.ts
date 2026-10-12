// An agent signing in to Guildhall over Better-Auth's real endpoints, on a test database, the way the MCP Inspector
// does it: register, send the person to authorize, take the consent page's choice, swap the code for a token (PKCE).
import { createHash, randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { vi } from "vitest";
import { authOptions, MCP_RESOURCE } from "@/lib/auth/server";
import type { Db } from "@/lib/db/client";
import { env } from "@/lib/env";

export const REDIRECT_URI = "http://localhost:6274/oauth/callback";
export const ALL_SCOPES = "openid profile email offline_access guildhall:read guildhall:write";

export type TestAuth = ReturnType<typeof testAuth>;

// Better-Auth on the test database. requireMcpAuth fetches the signing keys from /api/auth/jwks; that request is
// answered here by the same auth, in process.
export function testAuth(db: Db) {
  const auth = betterAuth(authOptions(db, null));
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => auth.handler(new Request(input, init)));
  return auth;
}

const api = (path: string) => `${env.authUrl}/api/auth${path}`;

async function postJson(auth: TestAuth, path: string, body: unknown, cookie?: string) {
  return auth.handler(new Request(api(path), {
    method: "POST",
    headers: { "content-type": "application/json", origin: env.authUrl, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  }));
}

// Signs the owner up and returns their session cookie.
export async function signUpOwner(auth: TestAuth): Promise<string> {
  const res = await postJson(auth, "/sign-up/email", { name: "Margery Kempe", email: "owner@example.com", password: "lynn ledger 1373" });
  if (res.status !== 200) throw new Error(`sign-up: ${res.status}`);
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

// Dynamic client registration, as an agent does with no account: a public client, so it must use PKCE. A loopback
// redirect makes it a native app, as the Inspector (2.10) declares itself.
export async function registerAgent(auth: TestAuth, name: string | null = "MCP Inspector"): Promise<string> {
  const res = await auth.handler(new Request(api("/oauth2/register"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...(name === null ? {} : { client_name: name }), redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], application_type: "native",
    }),
  }));
  if (res.status !== 200 && res.status !== 201) throw new Error(`register: ${res.status} ${await res.text()}`);
  return (await res.json()).client_id;
}

// The person's browser opening the agent's authorize link. Returns where Better-Auth sends them (the consent page,
// or sign-in first) and the PKCE verifier the agent keeps.
export async function authorize(auth: TestAuth, clientId: string, cookie?: string, scope = ALL_SCOPES) {
  const verifier = randomBytes(32).toString("base64url");
  const query = new URLSearchParams({
    response_type: "code", client_id: clientId, redirect_uri: REDIRECT_URI, scope, state: "agent-state",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256",
    resource: MCP_RESOURCE,
  });
  const res = await auth.handler(new Request(api(`/oauth2/authorize?${query}`), {
    headers: { accept: "text/html", ...(cookie ? { cookie } : {}) },
  }));
  const location = res.headers.get("location");
  if (!location) throw new Error(`authorize: ${res.status} ${await res.text()}`);
  return { location: new URL(location, env.authUrl), verifier };
}

// What the consent page sends when the person chooses: the page's signed query, and the scopes they allow.
export async function consent(auth: TestAuth, cookie: string, consentPage: URL, body: { accept: boolean; scope?: string }) {
  const res = await postJson(auth, "/oauth2/consent", { ...body, oauth_query: consentPage.search.slice(1) }, cookie);
  if (res.status !== 200) throw new Error(`consent: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return new URL(data.url ?? data.redirect_uri);
}

export async function exchangeCode(auth: TestAuth, clientId: string, code: string, verifier: string) {
  const res = await auth.handler(new Request(api("/oauth2/token"), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI, client_id: clientId, code_verifier: verifier,
      resource: MCP_RESOURCE,
    }),
  }));
  if (res.status !== 200) throw new Error(`token: ${res.status} ${await res.text()}`);
  return (await res.json()) as { access_token: string; scope: string; refresh_token?: string };
}

// The whole sign-in: the owner allows the agent with the scopes the consent page sends.
export async function connectAgent(auth: TestAuth, cookie: string, scope: string) {
  const clientId = await registerAgent(auth);
  const { location, verifier } = await authorize(auth, clientId, cookie);
  const back = await consent(auth, cookie, location, { accept: true, scope });
  return exchangeCode(auth, clientId, back.searchParams.get("code")!, verifier);
}

// The claims in a JWT, unchecked: tests only read what Better-Auth put there.
export function claims(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
}
