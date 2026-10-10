# The agent log

I want to see everything an agent has changed, and when.

## What it should do
- Every write tool records: the agent's name, the person it acts for, the tool, the one-line summary it returned, and
  when. Read tools aren't recorded.
- An owner-only page `/settings/agent-log`: newest first, 50 per page, filter by agent.
- Records that a change touched link to their pages.

## Done when
- [ ] After Claude moves a deal, the log shows "Claude, for Emile: Moved 'Acme fit-out' from Proposal to Won", with
  the time.
- [ ] Tests: integration tests that each write tool records an entry and read tools don't; a Playwright test for the
  page.
- [ ] Tried in a browser
