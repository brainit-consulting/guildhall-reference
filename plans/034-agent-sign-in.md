# 034 — Sign-in for agents

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-11

## Goal

An agent such as the MCP Inspector finds Guildhall's sign-in through the discovery addresses, registers itself, sends
the owner through `/consent` (Read only by default, or Read and change), and then calls `/mcp` with a token; without
one `/mcp` answers 401 with a `WWW-Authenticate` header pointing at the protected-resource address.

## Why

Issue #81 (Intermediate chapter 5). Chapter 4's `/mcp` was only reachable on this computer and answered 404 on Vercel.
Sign-in replaces that guard so the live address can be connected to.

## Approach

`better-auth`'s `jwt()` plus `@better-auth/mcp`'s `mcp()` (which is `@better-auth/oauth-provider` configured for one
protected resource, `<app address>/mcp`), all 1.7.5, added to `authOptions` so tests build the same auth on
`createTestDb()`. The live auth instance is made on first use: Better-Auth starts up when it is made and the OAuth
plugin then writes the /mcp resource row, which would open the database during `next build`. Their tables are
copied from Better-Auth's own Drizzle schema generator into `schema.ts`, with a new migration. `/mcp` checks the
bearer token with `requireMcpAuth` (keys from the app's own `/api/auth/jwks`), requires `guildhall:read`, loads the
person it was issued to and passes them to the MCP server. The `/consent` page narrows the
granted scopes to what the owner picks, never adding `guildhall:write` for Read only.

## Tasks

### Task 1: Auth server

- [x] **Step 1:** Install `@better-auth/oauth-provider@1.7.5` and `@better-auth/mcp@1.7.5` exactly.
- [x] **Step 2:** `jwt()` and `mcp()` in `authOptions`: scopes, open dynamic registration, PKCE (the default for
  public clients), login `/signin`, consent `/consent`.
- [x] **Step 3:** Tables in `schema.ts`, `npm run db:generate`.
- [x] **Step 4:** Discovery routes under `/.well-known/…`, answered by Better-Auth.

### Task 2: The endpoint

- [x] **Step 1:** `/mcp`: drop the Vercel 404 and localhost-only checks; verify the token, require `guildhall:read`,
  401 with `resource_metadata` otherwise; run the server as the token's person.
- [x] **Step 2:** Integration tests: 401 and its header, discovery JSON, a full sign-in where Read only never grants
  `guildhall:write`, and Read and change does.

### Task 3: Consent page

- [x] **Step 1:** `/consent`: "<agent> wants to use your Guildhall", Read only (default) / Read and change, Allow /
  Don't allow. Sign-in page continues the agent's sign-in when it came from one.
- [x] **Step 2:** Playwright test for the consent page.

### Task 4: Try it

- [x] **Step 1:** MCP Inspector against the dev server on port 5856: sign in, consent, list tools.
- [x] **Step 2:** typecheck, lint, test, test:e2e, build.

## Acceptance

- [x] `/mcp` without a token answers 401 with the `resource_metadata` address; discovery addresses answer JSON.
- [x] The Inspector signs in through the consent page and lists the tools.

## Risks / open questions

- A token that is valid but lacks `guildhall:read` gets 403 `insufficient_scope` (RFC 6750), not 401; Guildhall's
  consent always grants `guildhall:read`, so only a token an agent narrowed itself can meet it.
- The 401 names both `guildhall:read` and `guildhall:write` as the scopes to ask for. Measured with the Inspector
  2.10.1: it asks for exactly what the challenge names, so with only `guildhall:read` there, Read and change could
  never be granted.
- Agents with a loopback callback must register as native apps (`application_type: "native"`); Better-Auth refuses
  loopback redirects for web apps. The Inspector 2.10.1 does this, and the current MCP SDK infers it.
- Consent can only narrow what the agent asked for (Better-Auth refuses scopes not requested). If an agent asks only
  for `guildhall:read`, Read and change is shown but can't be granted; the page says so.
