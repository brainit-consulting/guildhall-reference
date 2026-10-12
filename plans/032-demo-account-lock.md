# 032 — Demo account can't be changed or deleted

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-11

## Goal

With `DEMO_EMAIL` set, the shared demo account's password, email and name can't be changed and it can't be deleted
through Better-Auth's endpoints; every other account, and every copy without the setting, works as before (issue #74).

## Why

The live Guildhall is a showcase with one shared demo sign-in. Better-Auth answers `change-password`, `change-email`,
`update-user` and `delete-user` even though the app has no screen for them, so a student could lock everyone out.

## Approach

`DEMO_EMAIL` goes through `src/lib/env.ts`. A plain rule in `src/lib/demo.ts` says whether a request path is one the
demo account may not make; a Better-Auth `hooks.before` middleware looks up the session for those paths only and
refuses with `DEMO_LOCKED`. The auth options are built by a function taking the database and the demo email, so an
integration test can run the real endpoints on `createTestDb()`.

## Tasks

### Task 1: setting

- [x] **Step 1:** `DEMO_EMAIL` in the env schema (optional, an email, lower-cased; empty counts as unset), tests,
  `.env.example`.

### Task 2: rule and hook

- [x] **Step 1:** `src/lib/demo.ts`: `isDemoLockedPath`, `isDemoAccount`, `demoGuard` (hook), with unit tests.
- [x] **Step 2:** `src/lib/auth/server.ts`: `authOptions(db, demoEmail)`, hook wired in; message added.
- [x] **Step 3:** integration test: the four requests refused for the demo account, allowed for another, allowed for
  everyone without the setting; sign-in and sign-out still work for the demo account.

### Task 3: end to end

- [x] **Step 1:** e2e server runs with `DEMO_EMAIL`; `e2e/demo.spec.ts` signs the demo account in and out in the browser
  and sees the four requests refused.

## Acceptance

- [x] typecheck, lint, unit, integration, e2e and build pass.
- [x] Tried in a browser against a dev server with `DEMO_EMAIL` set.

## Risks / open questions

- `revoke-sessions` / `revoke-other-sessions` would sign other students out of the demo account; they can sign back in,
  so it's left alone (not in the issue).
