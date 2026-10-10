# 001 — Sign-up and sign-in pages

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-10

## Goal

People can create an account at `/signup`, sign in at `/signin`, land on `/home` ("Welcome, <name>."), and sign out.

## Why

Issue #1. Every later page needs someone signed in. Better-Auth and its tables already exist; only the pages are missing.

## Approach

One client form component drives both pages through the existing Better-Auth client (`signUp.email`, `signIn.email`),
then moves to `/home`. Better-Auth error codes become plain sentences in a small pure function with a unit test. `/home`
calls `requireSession()`; `/` redirects signed-in people to `/home`. No schema change: the auth tables are already on main.

## Tasks

### Task 1: Error words

- [x] **Step 1:** `src/lib/auth/messages.ts` maps Better-Auth error codes to one-sentence messages.
- [x] **Step 2:** `src/lib/auth/messages.test.ts` covers each code and the fallback.

### Task 2: Pages

- [x] **Step 1:** `src/components/auth-form.tsx`: shared client form, error shown above the button with `role="alert"`.
- [x] **Step 2:** `/signup` and `/signin` pages, each linking to the other; signed-in visitors go to `/home`.
- [x] **Step 3:** `/home` with `requireSession()` and a "Sign out" button that returns to `/signin`.
- [x] **Step 4:** `/` gets "Sign in" and "Create account" links and redirects signed-in visitors.

### Task 3: Tests and checks

- [x] **Step 1:** `e2e/auth.spec.ts`: sign up, sign out, sign in; `/home` signed out goes to `/signin`; wrong password message.
- [x] **Step 2:** typecheck, lint, test, test:e2e, build; try it in a browser.

## Acceptance

- [x] Create an account, sign out, sign back in.
- [x] `/home` while signed out lands on `/signin`.

## Risks / open questions

- "First person becomes owner" and closed sign-up are the next issue (B6, issue 02); not built here.
