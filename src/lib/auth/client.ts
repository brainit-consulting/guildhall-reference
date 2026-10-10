"use client";

import { createAuthClient } from "better-auth/react";

// No explicit baseURL — Better-Auth uses the current origin, which is
// correct for same-origin auth. Avoid importing @/lib/env from a client
// module: env.ts eagerly validates server-only vars (DATABASE_URL etc.)
// and would throw at module load in the browser.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
