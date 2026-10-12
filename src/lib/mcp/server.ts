// The MCP server: the read tools registered with what an agent needs to pick and call them. A fresh server per
// request (createMcpHandler is stateless), built over whichever database it is given.
import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { BUSINESS_NAME } from "@/lib/brand";
import { APP_VERSION } from "@/lib/version";
import {
  getCompanyRecord, getContactRecord, getDealRecord, listPipeline, listTasksDue, MAX_DAYS_AHEAD, searchContacts,
} from "./read-tools";

// The tools only look; an agent may call them as often as it likes.
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

function data(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function notFound(what: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: `No ${what} has that ID. Find it with search_contacts or list_pipeline.` }] };
}

const id = z.string().describe("The record's ID, as another Guildhall tool returned it.");

export function createGuildhallServer(db: Db): McpServer {
  const server = new McpServer({ name: "guildhall", title: `${BUSINESS_NAME} (Guildhall)`, version: APP_VERSION });

  server.registerTool("search_contacts", {
    title: "Search contacts",
    description: "Find up to 20 contacts whose name, email or company contains the query, with each one's ID for get_contact.",
    inputSchema: z.object({ query: z.string().max(100).describe("Part of a name, email address or company name.") }),
    annotations: READ_ONLY,
  }, async ({ query }) => data(await searchContacts(db, query)));

  server.registerTool("get_contact", {
    title: "Get a contact",
    description: "Read one contact by ID: their details, company, open tasks and last 10 activities.",
    inputSchema: z.object({ id }),
    annotations: READ_ONLY,
  }, async (args) => {
    const found = await getContactRecord(db, args.id);
    return found ? data(found) : notFound("contact");
  });

  server.registerTool("get_company", {
    title: "Get a company",
    description: "Read one company by ID: its details, open tasks and last 10 activities.",
    inputSchema: z.object({ id }),
    annotations: READ_ONLY,
  }, async (args) => {
    const found = await getCompanyRecord(db, args.id);
    return found ? data(found) : notFound("company");
  });

  server.registerTool("get_deal", {
    title: "Get a deal",
    description: "Read one deal by ID: its stage, value, contact, company, open tasks and last 10 activities.",
    inputSchema: z.object({ id }),
    annotations: READ_ONLY,
  }, async (args) => {
    const found = await getDealRecord(db, args.id);
    return found ? data(found) : notFound("deal");
  });

  server.registerTool("list_pipeline", {
    title: "List the pipeline",
    description: "List every deal stage in order (New, Contacted, Proposal, Won, Lost) with its deal count, total value and deals.",
    annotations: READ_ONLY,
  }, async () => data(await listPipeline(db)));

  server.registerTool("list_tasks_due", {
    title: "List tasks due",
    description: "List open tasks due within the given number of days from today, overdue ones first; use 0 for overdue and today only.",
    inputSchema: z.object({
      days: z.int().min(0).max(MAX_DAYS_AHEAD).describe("How many days ahead of today to include, 0 to 366."),
    }),
    annotations: READ_ONLY,
  }, async ({ days }) => data(await listTasksDue(db, days)));

  return server;
}
