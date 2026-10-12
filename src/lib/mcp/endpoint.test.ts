import { describe, expect, it, vi } from "vitest";
import { mcpEndpoint } from "./endpoint";

const listTools = (host = "localhost:3000", headers: Record<string, string> = {}) =>
  new Request(`http://${host}/mcp`, {
    method: "POST",
    headers: { host, "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });

describe("the /mcp endpoint", () => {
  it("answers 404 when the app runs on Vercel, without opening the database", async () => {
    const db = vi.fn(() => { throw new Error("opened the database"); });
    const res = await mcpEndpoint({ onVercel: true, db })(listTools("guildhall.example"));
    expect(res.status).toBe(404);
    expect(db).not.toHaveBeenCalled();
  });

  it("refuses a request addressed to another host name, as a rebound DNS name would be", async () => {
    const db = vi.fn(() => { throw new Error("opened the database"); });
    const res = await mcpEndpoint({ onVercel: false, db })(listTools("attacker.example"));
    expect(res.status).toBe(403);
    expect(db).not.toHaveBeenCalled();
  });

  it("refuses a web page from another site", async () => {
    const db = vi.fn(() => { throw new Error("opened the database"); });
    const res = await mcpEndpoint({ onVercel: false, db })(listTools("localhost:3000", { origin: "https://attacker.example" }));
    expect(res.status).toBe(403);
    expect(db).not.toHaveBeenCalled();
  });
});
