// The live showcase shares one demo account (DEMO_EMAIL). Better-Auth answers these endpoints even though the app has
// no screen for them, so a student signed in as the demo could change its password and lock everyone else out.
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { authErrorMessage } from "@/lib/auth/messages";

// delete-user/callback finishes a deletion confirmed by email; Guildhall sends none, but it is refused all the same.
const LOCKED_PATHS = new Set(["/change-password", "/change-email", "/update-user", "/delete-user", "/delete-user/callback"]);

export function isDemoLockedPath(path: string): boolean {
  return LOCKED_PATHS.has(path);
}

export function isDemoAccount(demoEmail: string | null, email: string | undefined | null): boolean {
  return !!demoEmail && !!email && email.trim().toLowerCase() === demoEmail;
}

// Better-Auth's `hooks.before`: looks up the session only on the locked paths, so nothing else pays for it.
export function demoGuard(demoEmail: string | null) {
  return createAuthMiddleware(async (ctx) => {
    if (!demoEmail || !isDemoLockedPath(ctx.path)) return;
    const session = await getSessionFromCtx(ctx);
    if (isDemoAccount(demoEmail, session?.user.email))
      throw APIError.from("FORBIDDEN", { code: "DEMO_LOCKED", message: authErrorMessage("DEMO_LOCKED") });
  });
}
