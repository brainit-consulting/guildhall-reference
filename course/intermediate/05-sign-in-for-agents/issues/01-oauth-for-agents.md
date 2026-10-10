# Sign-in for agents

Before an agent can reach my Guildhall over the internet, it must sign in as me, and I must say what it may do.

## What it should do
- Agents sign in with OAuth using Better-Auth's own plugins, at the same version as `better-auth`:
  `jwt()`, `@better-auth/oauth-provider` and `@better-auth/mcp`.
  - The protected resource is `<app address>/mcp`.
  - Scopes: `guildhall:read` and `guildhall:write`, plus `openid profile email offline_access`.
  - Agents register themselves (dynamic client registration) and must use PKCE.
- A consent page `/consent`, in Guildhall's look: "<agent name> wants to use your Guildhall", signing in first if
  needed. I choose what it may do there, whatever the agent asked for: **Read only** (selected by default) or **Read
  and change** (adds contacts, logs activities, moves deals). Then "Allow" or "Don't allow". The agent's token
  carries `guildhall:write` only if I chose Read and change.
- The discovery addresses agents look for: `/.well-known/oauth-protected-resource` (and `…/mcp`),
  `/.well-known/oauth-authorization-server` and `/.well-known/openid-configuration` (also under `/api/auth`),
  answered by Better-Auth.
- `/mcp` accepts only a valid token with `guildhall:read`; without one it answers 401 with a `WWW-Authenticate`
  header pointing at the protected-resource address.
- Every tool runs as the person who connected the agent.
- Remove last chapter's "404 on Vercel" guard: sign-in now protects the endpoint.
- New database tables through a migration, as usual.

## Done when
- [ ] `/mcp` without a token answers 401 with the `resource_metadata` address; the discovery addresses answer JSON.
- [ ] The MCP Inspector connects to the live address, signs in through the consent page and lists the tools.
- [ ] Tests: integration tests for the 401, the discovery responses, and that Read only never grants
  `guildhall:write`; a Playwright test for the consent page.
- [ ] Tried with the MCP Inspector
