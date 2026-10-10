# Guildhall CRM: the product

What Guildhall does once both courses are finished, and which chapter adds each part (B = Beginner, I =
Intermediate). Build only what your issue asks for; this page is the map, not the order of work.

## Who uses it

- One business per copy. No multiple organisations.
- The first person to sign up becomes the **owner**. After that, sign-up is closed except to email addresses the
  owner adds in Settings. No email service is needed. (B6)
- Everyone signed in sees the same records.

## Records

| Record | Fields | Chapter |
| --- | --- | --- |
| Company | name (required), website, phone, notes | B8 |
| Contact | name (required), email, phone, job title, notes, company (optional) | B7, B8 |
| Deal | title, value (`numeric(12,2)`), stage, contact, company, expected close date, last activity, source | B9, B11, B15 |
| Activity | kind (note, call, meeting, stage change), text, who, when; attached to a contact, company or deal | B11 |
| Task | title, due date, done, attached to a contact, company or deal | B12 |
| Client | made from a Won deal's company (or contact) | I10 |
| Project | name, client, status (Active, Done), budget, start and end dates | I10 |
| Invoice | number (`INV-0001` upwards, never reused), client, optional project, issue and due dates, lines (description, quantity, unit price), tax rate copied from Settings, status (Draft, Sent, Paid) | I11 |

Deal stages are fixed: **New, Contacted, Proposal, Won, Lost**. "Open" means New, Contacted or Proposal.

## Pages

- `/signup`, `/signin`, `/home`, `/settings` (owner: allowed emails, the enquiry form link, business address, tax rate). (B6, B15, I11)
- A left-hand menu; a top bar under 768px. (B6)
- `/contacts`, `/companies`, `/deals`: tables with search, sorting and (deals) stage filters kept in the address.
  (B7–B9, B13)
- `/pipeline`: five columns; drag a card or use "Move to…"; counts and totals per column. (B10)
- A timeline of activities on each contact, company and deal page. (B11)
- `/tasks`, and "Overdue" and "Due today" on Home. (B12)
- Home as a dashboard: open deals and their value, won this month, deals per stage, due today, going cold; every
  number links to its list. (B14)
- `/enquire`: the public enquiry form. (B15)
- `/clients`, `/projects`, invoices with "Download PDF". (I10, I11)
- `/settings/connections` and `/settings/agent-log` (owner). (I9)

## Your business's look

- The business's name, brand colour and logo, set in `src/lib/brand.ts` and `public/brand/`, replace "Guildhall"
  and the starter's accent everywhere; accent text keeps at least 4.5 to 1 contrast. (B17)

## Rules

- **Going cold:** an open deal with nothing logged for 14 days. (B14)
- **Last activity:** updated whenever an activity is logged on the deal, its contact or its company. (B11)
- **Stage changes** are logged as activities ("Moved from X to Y"). (B11)
- **Enquiries** create (or reuse, by email) a contact and a New deal "Enquiry from <name>", source "Web form", with
  the message as a note. A hidden field catches bots; at most 5 enquiries per email per day. (B15)
- **Automations:** moving a deal to Won creates "Thank <contact> and ask for a referral", due in 7 days, once per
  deal. Each cold deal gets one "Check in with <contact> about <deal>" task; logging an activity resets it. (B16)
- **Money** shows two decimals in the currency set in `src/lib/money.ts`. (B9)

## Agents (MCP)

An MCP endpoint at `/mcp` (Streamable HTTP, MCP spec 2026-07-28) so a business owner can bring their own agent,
such as Claude or ChatGPT. (I4–I12)

- **Sign-in:** OAuth through Better-Auth's `@better-auth/oauth-provider` and `@better-auth/mcp`, with a consent page
  naming the agent, where the owner of the account chooses Read only (the default) or Read and change. Scopes `guildhall:read` and `guildhall:write`. Each agent acts as the person
  who connected it. (I5)
- **Read tools** (`readOnlyHint`): `search_contacts`, `get_contact`, `get_company`, `get_deal`, `list_pipeline`,
  `list_tasks_due`, `list_clients`, `list_projects`, `get_invoice`. (I4, I12)
- **Write tools** (need `guildhall:write`): `add_contact`, `log_activity`, `move_deal_stage`, `create_invoice_draft`
  (Draft only). No delete tools. Every write is recorded in the agent log. (I8, I12)
- **Connections:** the owner sees each connected agent and can disconnect it; its next call fails. (I9)

## Not in Guildhall

Multiple organisations, card payments, email sync, configurable stages, calendar and Gantt views, forecasting, CSV
import.
