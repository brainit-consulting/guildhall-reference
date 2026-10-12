"use client";

import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { createAuthClient } from "better-auth/react";

// No explicit baseURL — Better-Auth uses the current origin, which is
// correct for same-origin auth. Avoid importing @/lib/env from a client
// module: env.ts eagerly validates server-only vars (DATABASE_URL etc.)
// and would throw at module load in the browser.
// oauthProviderClient sends an agent's signed sign-in request (I5) along with sign-in, so Better-Auth carries on to
// /consent afterwards.
export const authClient = createAuthClient({ plugins: [oauthProviderClient()] });

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
