// The MCP server: the read and write tools registered with what an agent needs to pick and call them. A fresh server per
// request (createMcpHandler is stateless), built over whichever database it is given, for the person who connected
// the agent (I5): the tools run as them.
import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { BUSINESS_NAME } from "@/lib/brand";
import { APP_VERSION } from "@/lib/version";
import {
  getCompanyRecord, getContactRecord, getDealRecord, listPipeline, listTasksDue, MAX_DAYS_AHEAD, searchContacts,
} from "./read-tools";
import { addContact, LOG_KINDS, logActivityOn, moveDeal, type Agent, type WriteResult } from "./write-tools";
import { DEAL_STAGES } from "@/lib/deal-stages";
import type { LoggedAgent } from "@/lib/agent-log";

// The tools only look; an agent may call them as often as it likes.
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
// The write tools add or move; none removes or overwrites anything.
const CHANGES = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;

function said(result: WriteResult): CallToolResult {
  return { ...(result.ok ? {} : { isError: true }), content: [{ type: "text", text: result.text }] };
}

function data(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function notFound(what: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: `No ${what} has that ID. Find it with search_contacts or list_pipeline.` }] };
}

const id = z.string().describe("The record's ID, as another Guildhall tool returned it.");

// Who signed the agent in. Never a token.
export type Person = { id: string; name: string };

// `client`: the agent itself, named in the agent log. `canChange`: the token carries guildhall:write. The write tools
// are listed either way, so a read-only agent that tries one is told how to get the access, not that the tool doesn't
// exist.
export function createGuildhallServer(db: Db, person: Person, client: LoggedAgent, canChange: boolean): McpServer {
  const agent: Agent = { ...client, userId: person.id, canChange };
  const server = new McpServer(
    { name: "guildhall", title: `${BUSINESS_NAME} (Guildhall)`, version: APP_VERSION },
    { instructions: `${BUSINESS_NAME}'s Guildhall, a CRM. You are signed in as ${person.name}.` },
  );

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

  server.registerTool("add_contact", {
    title: "Add a contact",
    description: "Add one person to contacts; an email another contact already has is refused, naming that contact.",
    inputSchema: z.object({
      name: z.string().max(200).describe("Their full name."),
      email: z.string().max(254).optional().describe("Their email address."),
      phone: z.string().max(40).optional().describe("Their phone number."),
      job_title: z.string().max(200).optional().describe("Their job title."),
      company: z.string().max(200).optional().describe("The company's name; an existing company of that name is used, or a new one added."),
    }),
    annotations: CHANGES,
  }, async (args) => said(await addContact(db, agent, args)));

  server.registerTool("log_activity", {
    title: "Log a note, call or meeting",
    description: "Write a note, call or meeting on a contact, company or deal by ID; it counts as the deal's last activity.",
    inputSchema: z.object({
      record_id: z.string().describe("The contact's, company's or deal's ID, as another Guildhall tool returned it."),
      kind: z.enum(LOG_KINDS).describe("note, call or meeting."),
      text: z.string().min(1).max(5000).describe("What happened, as it should read on the record's timeline."),
    }),
    annotations: CHANGES,
  }, async (args) => said(await logActivityOn(db, agent, args)));

  server.registerTool("move_deal_stage", {
    title: "Move a deal to another stage",
    description: "Move a deal by ID to New, Contacted, Proposal, Won or Lost; the move is logged on the deal, and Won adds a follow-up task.",
    inputSchema: z.object({
      deal_id: z.string().describe("The deal's ID, as get_deal or list_pipeline returned it."),
      stage: z.enum(DEAL_STAGES).describe("The stage to move it to."),
    }),
    // moving to the stage it is already at changes nothing
    annotations: { ...CHANGES, idempotentHint: true },
  }, async (args) => said(await moveDeal(db, agent, args)));

  return server;
}
