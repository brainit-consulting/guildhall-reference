# 033 — An MCP endpoint with read tools

**Status:** done (e2e and build left to CI: local run ran out of memory)
**Owner:** Aldric the Smith
**Last updated:** 2026-10-11

## Goal

An agent pointed at `http://localhost:<port>/mcp` lists six read tools and each returns real data; on Vercel the
endpoint answers 404 until agents can sign in.

## Why

Issue #78 (Intermediate chapter 4): the owner wants agents such as Claude to look things up in Guildhall. Read only,
and only on this computer, until the sign-in chapter.

## Approach

`@modelcontextprotocol/server` 2.3.1 pinned. One plain function per tool in `src/lib/mcp/read-tools.ts`, each taking
`db` and reusing the record modules (contacts, companies, deals, tasks, activities, pipeline), so the pages and the
tools can't disagree. `src/lib/mcp/server.ts` registers them on a fresh `McpServer` per request; `src/lib/mcp/endpoint.ts`
answers 404 on Vercel and otherwise hands the request to `createMcpHandler` behind localhost Host/Origin checks.
`src/app/mcp/route.ts` is the thin Next.js route.

## Tasks

### Task 1: SDK and tools

- [x] **Step 1:** Install `@modelcontextprotocol/server@2.3.1` exactly.
- [x] **Step 2:** `listActivities` takes an optional limit (last 10 for the tools).
- [x] **Step 3:** The six tool functions, money as `formatMoney` text and a plain number.
- [x] **Step 4:** Integration tests for each on `createTestDb()`.

### Task 2: Endpoint

- [x] **Step 1:** `server.ts`: register six tools, one-sentence descriptions, `readOnlyHint: true`.
- [x] **Step 2:** `endpoint.ts`: 404 on Vercel; localhost Host/Origin checks; stateless handler.
- [x] **Step 3:** Unit test: refuses on Vercel; lists six read-only tools in-process.
- [x] **Step 4:** `src/app/mcp/route.ts`; e2e test that `/mcp` lists the tools.

### Task 3: Try it

- [x] **Step 1:** MCP Inspector against the dev server on port 5856: list tools, call each.
- [ ] **Step 2:** typecheck, lint, test pass; test:e2e and build not completed here (machine ran out of memory), CI runs both.

## Acceptance

- [x] The Inspector lists the six tools and each returns real data.
- [x] `/mcp` answers 404 when `VERCEL=1`.

## Risks / open questions

- "Plain numbers" for money: the stored string is turned into a JSON number only at the tool's edge, next to the
  exact formatted text. numeric(12,2) fits a double exactly enough to print the same two decimals.
