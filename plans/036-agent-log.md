# 036 — The agent log

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-12

## Goal

Every change an agent makes through a write tool is recorded, and the owner reads them on `/settings/agent-log`:
"Claude, for Emile: Moved 'Acme fit-out' from Proposal to Won", with the time and a link to the deal.

## Why

Issue #85 (Intermediate chapter 9). The owner should be able to see everything an agent changed, and when.

## Approach

A new `agent_log` table. The write tools record an entry themselves when they change something (a refusal or "already
at Won" records nothing), so each tool's recording is tested on `createTestDb()` without the endpoint. The agent's
name is the OAuth client's name, looked up by the endpoint and kept on the entry, so the log outlives a disconnected
agent. The page reads 50 entries a page, newest first, filtered by agent (its client ID in the address).

## Tasks

### Task 1: Recording

- [x] **Step 1:** `agent_log` in the schema, a migration.
- [x] **Step 2:** `src/lib/agent-log.ts`: `recordAgentChange`, `listAgentLog` (page, agent), `listLoggedAgents`.
- [x] **Step 3:** The write tools say which record they touched and record an entry; `Agent` carries the client's ID
  and name; the endpoint looks the name up.
- [x] **Step 4:** Integration tests: each write tool records one entry, refusals and read tools record none.

### Task 2: The page

- [x] **Step 1:** `/settings/agent-log` (owner only): entries, filter by agent, Newer/Older pages, links to records.
- [x] **Step 2:** A link to it from Settings.
- [x] **Step 3:** Playwright: an agent moves a deal; the log shows the line, the time and the link; a member is sent
  home.

## Acceptance

- [x] After an agent moves a deal, the log shows "<agent>, for <person>: Moved '<deal>' from Proposal to Won".
- [x] Tried in a browser at 375px and desktop.

## Risks / open questions

- Two connected agents with the same name (Claude Desktop and Claude Code both register as "Claude") show twice in
  the filter under one name. The Connections page (I9) can tell them apart.
- The entry is written after the change, not in one transaction with it (the rules it reuses don't run in one), so a
  failure in between leaves a change unrecorded. Rare, and the change itself still shows on the record's timeline.
