# 002 — The first person to sign up owns the Guildhall

**Status:** in-progress
**Owner:** Aldric the Smith
**Last updated:** 2026-10-10

## Goal

The first account is the owner; after that only emails the owner has added at `/settings` can sign up.

## Why

Issue #2 (spec B6). One business per copy: strangers who find the URL must not get in.

## Approach

A new `allowed_email` table, and a partial unique index so the database itself refuses a second owner. The rule lives
in `src/lib/access.ts` as plain functions taking `db`; Better-Auth calls it from a `user.create.before` database hook,
which sets the role or throws `SIGN_UP_CLOSED`. `/settings` is a server page with server actions, each re-checking
that the caller is the owner. In e2e, a setup project signs up the owner first; other tests ask the owner to allow
their emails.

## Tasks

### Task 1: Data and rule

- [ ] **Step 1:** `allowed_email` table and one-owner index in `schema.ts`; `npm run db:generate`.
- [ ] **Step 2:** `src/lib/access.ts`: role for a new account, the sign-up hook, list/add/remove allowed emails.
- [ ] **Step 3:** integration tests on `createTestDb()`; unit test for the email check and the new message.

### Task 2: Wiring and page

- [ ] **Step 1:** the hook in `src/lib/auth/server.ts`; `SIGN_UP_CLOSED` in `messages.ts`.
- [ ] **Step 2:** `requireOwner()` in `session.ts`; `/settings` with "People who may sign up": add, list, remove.

### Task 3: Tests and checks

- [ ] **Step 1:** Playwright: owner setup project; existing sign-up tests allow their emails first; `e2e/settings.spec.ts`.
- [ ] **Step 2:** typecheck, lint, test, test:e2e, build; try it in a browser.

## Acceptance

- [ ] The first account is the owner; a second sign-up with an unlisted email is refused with "Ask the owner to add
  your email in Settings."
- [ ] After the owner adds an email in Settings, that person can sign up.
- [ ] A member opening `/settings` lands on `/home`.

## Risks / open questions

- Two people signing up at the same instant on an empty Guildhall: the unique index lets only one become owner; the
  other sees the general "Something went wrong" message and can try again (then needs to be allowed).
- An allowed email stays on the list after that person signs up; the owner can remove it. Removing it does not remove
  the account.
- No link to Settings from Home yet: the menu is issue 03.
