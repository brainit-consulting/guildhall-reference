// Which database `npm run dev` / `npm run build` brings up to date. Vercel gives preview builds (one per pull
// request) the live DATABASE_URL too, so they must never migrate: only the production build does, after the merge.

/** @param {Record<string, string | undefined>} env @returns {"neon" | "pglite" | "skip"} */
export function migrationTarget(env) {
  if (env.VERCEL === '1' && env.VERCEL_ENV !== 'production') return 'skip';
  return env.DATABASE_URL ? 'neon' : 'pglite';
}
