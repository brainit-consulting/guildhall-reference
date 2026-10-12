// /mcp (I4): Streamable HTTP, stateless. Until agents can sign in (I5), it answers 404 on Vercel so nothing is open
// to the internet, and on this computer only to requests addressed to localhost, so a web page can't reach it through
// a rebound DNS name.
import {
  createMcpHandler, hostHeaderValidationResponse, localhostAllowedHostnames, localhostAllowedOrigins,
  originValidationResponse, type McpHttpHandler,
} from "@modelcontextprotocol/server";
import type { Db } from "@/lib/db/client";
import { createGuildhallServer } from "./server";

export type McpEndpoint = (request: Request) => Promise<Response>;

// `db` is a function so a refused request never opens the database.
export function mcpEndpoint(opts: { onVercel: boolean; db: () => Db }): McpEndpoint {
  let handler: McpHttpHandler | undefined;
  return async (request) => {
    if (opts.onVercel) return new Response("Not found", { status: 404 });
    const rejected = hostHeaderValidationResponse(request, localhostAllowedHostnames())
      ?? originValidationResponse(request, localhostAllowedOrigins());
    if (rejected) return rejected;
    handler ??= createMcpHandler(() => createGuildhallServer(opts.db()));
    return handler.fetch(request);
  };
}
