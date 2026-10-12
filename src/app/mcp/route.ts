// The MCP endpoint agents connect to (src/lib/mcp/endpoint.ts).
import { db } from "@/lib/db/client";
import { env } from "@/lib/env";
import { mcpEndpoint } from "@/lib/mcp/endpoint";

const handle = mcpEndpoint({ onVercel: env.onVercel, db: () => db });

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
