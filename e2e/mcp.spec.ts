import { expect, test } from "@playwright/test";

// An agent's first look at /mcp on the running app (I5): no token, so a 401 pointing at where to sign in, and the
// discovery addresses that tell it how.
test("/mcp without a token answers 401 with the protected-resource address", async ({ request, baseURL }) => {
  const res = await request.post("/mcp", {
    headers: { accept: "application/json, text/event-stream" },
    data: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
    timeout: 60_000,
  });
  expect(res.status()).toBe(401);
  expect(res.headers()["www-authenticate"]).toContain(`resource_metadata="${baseURL}/.well-known/oauth-protected-resource/mcp"`);
});

test("the discovery addresses answer JSON", async ({ request, baseURL }) => {
  for (const path of [
    "/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp",
    "/.well-known/oauth-authorization-server", "/.well-known/oauth-authorization-server/api/auth",
    "/.well-known/openid-configuration", "/api/auth/.well-known/openid-configuration",
  ]) {
    const res = await request.get(path, { timeout: 60_000 });
    expect(res.status(), path).toBe(200);
    const body = await res.json();
    expect(body.resource ?? body.issuer, path).toContain(baseURL!);
  }
});
