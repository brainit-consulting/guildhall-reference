# Invoicing through my agent

I want to say "invoice Acme for the March work" and have my agent prepare it for me to check.

## What it should do
- Read tools (`readOnlyHint: true`): `list_clients(query?)`, `list_projects(client_id?, status?)`,
  `get_invoice(id_or_number)`.
- One write tool, needing `guildhall:write`: `create_invoice_draft(client_id, project_id?, lines, due_date?)`. It only
  ever makes a Draft; it never marks anything Sent or Paid.
- It returns the invoice number, the totals and the address of the invoice page, so I can check it before sending.
- Recorded in the agent log like the other write tools.

## Done when
- [ ] Asking Claude to "invoice Acme for 10 hours of March work at 85 an hour" makes a correct Draft I can open.
- [ ] Tests: integration tests for each tool, including that the write tool can only make Drafts and is logged.
- [ ] Tried from Claude
