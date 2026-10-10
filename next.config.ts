import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  // PGlite loads its own WebAssembly and data files at run time; bundling it breaks those paths.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
