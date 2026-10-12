# 037 — Connected agents

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-12

## Goal

The owner sees on `/settings/connections` every agent that can reach Guildhall (its name, who connected it, Read only
or Read and change, when it connected, when it was last used) and can disconnect one, after which its next call to
`/mcp` is refused until someone allows it again.

## Why

Issue #86 (Intermediate chapter 10). Connecting an agent is undone nowhere yet.

## Approach

A connection is Better-Auth's `oauth_consent` row for one agent and one person. Measured on `createTestDb()`: the
access token is a JWT checked by its signature alone (no `oauth_access_token` row is written) and lives an hour, so
deleting rows can't stop it by itself. `/mcp` therefore also checks, on every request, that the token's agent and
person still have a consent row made no later than the token was issued; a token from before a disconnect stays
refused after a reconnect. Disconnect deletes the consent and the refresh and access token rows, so the agent has to
go through `/consent` again. A new `agent_last_use` table holds when each connection last called `/mcp`.

## Tasks

### Task 1: Connections

- [x] **Step 1:** `agent_last_use` in the schema, a migration.
- [x] **Step 2:** `src/lib/connections.ts`: `listConnections`, `isStillConnected`, `noteAgentUse`, `disconnectAgent`;
  unit tests for the rules, integration tests for each read and write.
- [x] **Step 3:** `/mcp` refuses a token whose connection is gone (401, so the agent signs in again) and notes the use.
- [x] **Step 4:** Integration test: a disconnected agent's token and refresh token are refused; reconnecting gives a
  token that works while the old one stays refused.

### Task 2: The page

- [x] **Step 1:** `/settings/connections` (owner only), Disconnect behind a dialog, the empty sentence.
- [x] **Step 2:** A link to it from Settings.
- [x] **Step 3:** Playwright: connect, see the row, disconnect, the agent's next call fails; a member is sent home.

## Acceptance

- [x] After disconnecting an agent, its next request to `/mcp` answers 401 until it is allowed again.
- [x] Tried in a browser at 375px and desktop.

## Risks / open questions

- "Last used" is written on every `/mcp` request, read tools included. It is bookkeeping about the connection, not a
  change to the business's records.
- A token issued in the same second as a new consent after a reconnect would be accepted: the times are kept to the
  second. A real reconnect takes far longer than that.
- Touch-sized buttons come from globals.css (`pointer: coarse`), measured at 44px in a 375px touch context.
