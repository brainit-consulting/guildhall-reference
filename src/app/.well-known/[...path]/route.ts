// OAuth discovery for agents (src/lib/auth/discovery.ts).
import { auth } from "@/lib/auth/server";
import { discovery } from "@/lib/auth/discovery";

export const GET = discovery(auth);
