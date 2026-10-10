# Connected agents

I need to see which agents can reach my Guildhall and cut one off.

## What it should do
- An owner-only page `/settings/connections`: each connected agent with its name, who connected it, what it may do
  (read, or read and change), when it connected and when it was last used.
- "Disconnect" (asks first) withdraws its consent and its tokens, so its next call to `/mcp` fails and it must ask
  again.
- With none: "No agents connected. The Intermediate course's chapter 6 shows how to connect Claude."

## Done when
- [ ] After I disconnect Claude, its next request fails until I reconnect it.
- [ ] Tests: an integration test that a disconnected agent's token is refused; a Playwright test for the page.
- [ ] Tried in a browser

Depends on #<number of the issue "The agent log">
