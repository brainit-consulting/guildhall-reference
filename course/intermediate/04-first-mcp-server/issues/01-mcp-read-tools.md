# An MCP endpoint with read tools

I want AI agents such as Claude to be able to look things up in Guildhall for me. Start with reading only, and only
on this computer until agents have to sign in.

## What it should do
- An MCP endpoint at `/mcp` using `@modelcontextprotocol/server` 2.x (`createMcpHandler`, stateless, Streamable
  HTTP), pinned to an exact version.
- Read tools, each with a plain one-sentence description an agent can act on and `readOnlyHint: true`:
  - `search_contacts(query)`: name, email, company and ID of up to 20 matches;
  - `get_contact(id)`, `get_company(id)`, `get_deal(id)`: the record, its open tasks and last 10 activities;
  - `list_pipeline()`: per stage, the count, total value and the deals in it;
  - `list_tasks_due(days)`: open tasks due within that many days, overdue first.
- Amounts come back formatted with `formatMoney` and as plain numbers.
- Until agents can sign in (next chapter), the endpoint answers 404 when the app runs on Vercel, so nothing is open
  to the internet.
- Keep the tools in their own folder (`src/lib/mcp/`), one function per tool that takes the database and returns
  plain data, so they can be tested without the endpoint.

## Done when
- [ ] The MCP Inspector, pointed at `http://localhost:<port>/mcp`, lists the six tools and each returns real data.
- [ ] Tests: integration tests for each tool on `createTestDb()` data; a unit test that the endpoint refuses when
  running on Vercel.
- [ ] Tried with the MCP Inspector
