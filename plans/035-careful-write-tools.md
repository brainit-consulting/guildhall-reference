# 035 — Careful write tools

**Status:** in-progress
**Owner:** Aldric the Smith
**Last updated:** 2026-10-12

## Goal

An agent signed in with `guildhall:write` can call `add_contact`, `log_activity` and `move_deal_stage` on `/mcp`;
each answers one line saying what changed, and an agent without the scope is told to reconnect and allow changes.

## Why

Issue #83 (Intermediate chapter 6). The read tools let an agent look; these three let it do small jobs that can't
lose anything. No delete tools.

## Approach

One plain function per tool in `src/lib/mcp/write-tools.ts`, taking the database and the agent (who it acts as, and
whether it may change things), reusing the pages' rules: `createContact`/`checkContact`, `logActivity` (last
activity), `moveDealStage` (stage-change log, Won follow-up). The scope check is inside each function so it is tested
without the endpoint. The endpoint passes the token's scopes to the server; the tools are listed to every agent, so
a read-only one learns why it can't use them.

## Tasks

### Task 1: The tools

- [ ] **Step 1:** `addContact`: name, email, phone, job title, company (found by name, any capitals, or added);
  refuses an email another contact has (any capitals), naming that contact.
- [ ] **Step 2:** `logActivityOn`: note, call or meeting on a contact, company or deal by ID.
- [ ] **Step 3:** `moveDeal`: moves and logs as the board does.
- [ ] **Step 4:** Integration tests on `createTestDb()`, including the refusal without the scope and the duplicate.

### Task 2: The endpoint

- [ ] **Step 1:** Register the three with `readOnlyHint: false`, `destructiveHint: false` and exact titles.
- [ ] **Step 2:** Pass the token's scopes from the endpoint to the server; endpoint tests for both kinds of token.

## Acceptance

- [ ] A Read-and-change agent adds a contact, logs a call and moves a deal; each shows in Guildhall.
- [ ] A Read-only agent gets "This agent may only read. Reconnect it and allow changes."

## Risks / open questions

- No unique index on contact email (existing books may hold duplicates), so two agents adding one email at the same
  instant could both succeed. Acceptable for one small business.
- The agent log (I8) isn't built yet; writes aren't recorded there until it is.
