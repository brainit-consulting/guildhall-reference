# 042 — Invoicing through the agent

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-12

## Goal

An agent can find a client and its projects, read an invoice by ID or number, and prepare a Draft invoice the owner
checks before sending, with the Draft recorded in the agent log.

## Why

Issue #97 (Intermediate chapter 12): "invoice Acme for the March work" ends in a Draft the owner can open.

## Approach

Three read tools in `read-tools.ts` (`list_clients`, `list_projects`, `get_invoice`) over the existing `listClients`,
`listProjects` and `getInvoice`. One write tool, `create_invoice_draft`, in `write-tools.ts` that calls
`createInvoice` (which only ever makes a Draft) with today's date as the issue day and 30 days to pay unless a due date
is given, then answers the number, the totals and the invoice page's full address. The address comes from the /mcp
resource's origin, so no new setting. The agent log learns a fourth record type, `invoice` (a new migration widens its
check), and links it on /settings/agent-log.

## Tasks

### Task 1: Agent log takes invoices

- [x] **Step 1:** `agent_log.record_type` allows `invoice`; new migration.
- [x] **Step 2:** `listAgentLog` names an invoice by its number; the log page links it.

### Task 2: Read tools

- [x] **Step 1:** `listClientsFor(query?)`, `listProjectsFor(client_id?, status?)`, `getInvoiceRecord(id_or_number)`.
- [x] **Step 2:** Integration tests, including that they write nothing.

### Task 3: The write tool

- [x] **Step 1:** `createInvoiceDraft`: refuses a read-only agent, sentences for bad input, always a Draft, logged.
- [x] **Step 2:** Registered in `server.ts`; the endpoint hands the server its address.
- [x] **Step 3:** Integration tests, and the endpoint test's tool list.

### Task 4: Try it

- [x] **Step 1:** Call the tools on the running app: 10 hours of March work at 85 an hour for Acme; open the Draft.

## Acceptance

- [x] "Invoice Acme for 10 hours of March work at 85 an hour" makes a Draft for $850.00 plus tax that opens.
- [x] The Draft shows in the agent log, linked to the invoice.
- [x] typecheck, lint, test, test:e2e, build pass.

## Risks / open questions

- Quantities and prices may arrive as JSON numbers; they are turned to text and checked as the form checks them.
