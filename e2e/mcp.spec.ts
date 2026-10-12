import { expect, test, type APIRequestContext } from "@playwright/test";

// An agent's view of /mcp on the running app: no sign-in yet (I5), so only this computer can reach it.
async function rpc(request: APIRequestContext, method: string, params: object) {
  const res = await request.post("/mcp", {
    headers: { accept: "application/json, text/event-stream" },
    data: { jsonrpc: "2.0", id: 1, method, params },
    timeout: 60_000,
  });
  expect(res.status()).toBe(200);
  const text = await res.text();
  const json = text.trimStart().startsWith("{") ? text : /^data: (.*)$/m.exec(text)![1];
  return JSON.parse(json).result;
}

test("an agent lists the six read tools and reads the pipeline", async ({ request }) => {
  const { tools } = await rpc(request, "tools/list", {});
  expect(tools.map((t: { name: string }) => t.name).sort()).toEqual([
    "get_company", "get_contact", "get_deal", "list_pipeline", "list_tasks_due", "search_contacts",
  ]);

  const result = await rpc(request, "tools/call", { name: "list_pipeline", arguments: {} });
  const stages = JSON.parse(result.content[0].text);
  expect(stages.map((s: { stage: string }) => s.stage)).toEqual(["New", "Contacted", "Proposal", "Won", "Lost"]);
});
