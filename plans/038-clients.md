# 038 — Clients

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-12

## Goal

"Make client" on a Won deal's page makes a client from the deal's company (or, with no company, its contact) and links
the deal to it, reusing the client that company already is; `/clients` lists them and each has a page.

## Why

Issue #89 (Intermediate chapter 10). Projects and invoices (next issues) hang off a client.

## Approach

A `client` table remembers what it was made from (`made_from`: company or contact), the company, the contact person
and the name at the time. Two partial unique indexes (one client per company, one per contact made without a company)
make "once" the database's job: `makeClient` inserts with `on conflict do nothing`, then reads the one that exists, so
two tabs pressing the button together still make one. `deal.client_id` links the deal. Pages show the company's (or
contact's) current name, falling back to the stored one when it has been deleted.

## Tasks

### Task 1: The rule

- [x] **Step 1:** `client` and `deal.client_id` in the schema, a migration.
- [x] **Step 2:** `src/lib/clients.ts`: `makeClient`, `listClients`, `getClient`, `listClientWonDeals`; demo reset
  clears clients.
- [x] **Step 3:** Integration tests: creates once, reuses for a second Won deal of the company, contact-only clients,
  refuses a deal that isn't Won or has neither, deleting the company keeps the client.

### Task 2: The pages

- [x] **Step 1:** "Make client" (or the linked client) on a Won deal's page.
- [x] **Step 2:** Clients in the menu; `/clients` with name, contact person, won deals; `/clients/[id]`.
- [x] **Step 3:** Playwright: make a client from two Won deals of one company, see one client with 2 won deals.

## Acceptance

- [x] "Make client" creates the client once; a second Won deal for the same company reuses it.
- [x] Tried in a browser at 375px and desktop.

## Risks / open questions

- "Won deals" on a client are the deals linked to it that are at Won now; a linked deal moved out of Won stays linked
  but stops counting.
- A deal with neither company nor contact can't become a client; its page says to add one.
- The client page has no Edit or Delete, and the name isn't typed by anyone: the issue asks for neither.
- Touch-sized buttons come from globals.css (`pointer: coarse`), as on every other page.
