# 022 — The public enquiry form

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-11

## Goal

`/enquire` is a public page with the business's name, a form and a thank-you; what is sent arrives through
`receiveEnquiry`, and deals that came from it read "Web form" on the deal page and in the Deals list.

## Why

Issue #44 (chapter 15, part 2 of 3). The owner links this page from their website.

## Approach

`src/app/enquire/` outside the (signed-in) group: a page, a server action wrapping `receiveEnquiry`, and a client form
on `useActionState` that swaps itself for the thank-you when the action says "saved" or "ignored". The name in the
thank-you comes from the action's result, never the address. `BUSINESS_NAME` lives in `src/lib/brand.ts`. No schema
change: `deal.source` came with #43.

## Tasks

### Task 1: Page

- [x] **Step 1:** `src/lib/brand.ts`; the action and its `thanksFor` sentence (unit test).
- [x] **Step 2:** the page and form: labels above, autocomplete, the off-screen trap, errors by their fields.

### Task 2: Web form on deals

- [x] **Step 1:** a "Source" line on the deal page, for deals that have one.
- [x] **Step 2:** "Web form" beside the title in the table and the phone list.

### Task 3: Checks

- [x] **Step 1:** `e2e/enquire.spec.ts` (signed out: send, same email twice, trap, errors; signed in: the marks).
- [x] **Step 2:** typecheck, lint, test, test:e2e, build; tried at 390px and 1280px, light and dark.

## Acceptance

- [x] Signed out, sending shows the thank-you; the owner sees the contact, the New deal marked Web form and the note.
- [x] The trap filled shows the thank-you and adds no deal.

## Risks / open questions

- The Source line shows only for deals with a source, so deals added by hand look as they did (the issue asks for
  nothing new on those).
