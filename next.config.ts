import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  // PGlite loads its own WebAssembly and data files at run time; bundling it breaks those paths.
  serverExternalPackages: ["@electric-sql/pglite"],
  // The invoice PDF reads its fonts and the logo from disk at run time (src/lib/pdf), which tracing can't see.
  outputFileTracingIncludes: {
    "/invoices/*/pdf": ["./src/lib/pdf/fonts/*.ttf", "./public/brand/**/*"],
  },
};

export default nextConfig;
