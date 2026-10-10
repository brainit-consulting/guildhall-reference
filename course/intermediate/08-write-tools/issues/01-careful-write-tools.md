# Careful write tools

Let my agent do small, safe jobs for me: add a contact, write down a call, move a deal. Nothing that deletes.

## What it should do
- Three write tools, each needing the `guildhall:write` scope, with `readOnlyHint: false` and
  `destructiveHint: false`, and a title that says exactly what it does:
  - `add_contact(name, email?, phone?, job_title?, company?)`: refuses a duplicate email and says which contact
    already has it;
  - `log_activity(record_id, kind, text)`: kind is note, call or meeting; updates the deal's last activity as usual;
  - `move_deal_stage(deal_id, stage)`: logs "Moved from X to Y" as usual, and runs the Won follow-up rule.
- Each returns one line saying what changed, for example "Moved 'Acme fit-out' from Proposal to Won."
- An agent without `guildhall:write` gets "This agent may only read. Reconnect it and allow changes."
- No delete tools.

## Done when
- [ ] Claude can add a contact, log a call and move a deal, and each shows up in Guildhall.
- [ ] Tests: integration tests for each tool, including refusal without the write scope and the duplicate email.
- [ ] Tried from Claude
