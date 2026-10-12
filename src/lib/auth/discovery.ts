// The discovery addresses agents look for before signing in (I5), all answered by Better-Auth:
//   /.well-known/oauth-protected-resource and …/mcp          what protects /mcp, and who signs agents in
//   /.well-known/oauth-authorization-server (and …/api/auth)  how to sign in
//   /.well-known/openid-configuration (and /api/auth/…)       the same, for OpenID clients
// Better-Auth's plugins answer the addresses that carry its /api/auth path; the two bare ones are its exported
// handlers. /api/auth/.well-known/openid-configuration goes through the /api/auth route as usual.
import { oauthProviderAuthServerMetadata, oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";

type DiscoveryAuth = Parameters<typeof oauthProviderAuthServerMetadata>[0]
  & Parameters<typeof oauthProviderOpenIdConfigMetadata>[0]
  & { handler(request: Request): Promise<Response> };

export function discovery(auth: DiscoveryAuth): (request: Request) => Promise<Response> {
  const authServer = oauthProviderAuthServerMetadata(auth);
  const openId = oauthProviderOpenIdConfigMetadata(auth);
  return async (request) => {
    const path = new URL(request.url).pathname.replace(/\/+$/, "");
    if (path === "/.well-known/oauth-authorization-server") return authServer(request);
    if (path === "/.well-known/openid-configuration") return openId(request);
    return auth.handler(request);
  };
}
