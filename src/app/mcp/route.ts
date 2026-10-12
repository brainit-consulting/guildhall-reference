// The MCP endpoint agents connect to (src/lib/mcp/endpoint.ts), behind agent sign-in.
import { auth, MCP_RESOURCE } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { mcpEndpoint } from "@/lib/mcp/endpoint";

const handle = mcpEndpoint({ auth, resource: MCP_RESOURCE, db: () => db });

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
