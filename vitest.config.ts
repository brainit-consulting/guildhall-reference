import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Two projects: `unit` (pure functions, settings) and `integration` (real queries on a fresh in-memory
// database from src/test/db.ts). Neither needs a secret or the network.
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    projects: [
      {
        resolve: {
          alias: {
            "@": resolve(__dirname, "./src"),
          },
        },
        test: {
          name: "unit",
          environment: "node",
          globals: false,
          setupFiles: ["./src/test/setup.ts"],
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          exclude: ["src/**/*.integration.test.ts", "node_modules", "modules"],
        },
      },
      {
        resolve: {
          alias: {
            "@": resolve(__dirname, "./src"),
          },
        },
        test: {
          name: "integration",
          environment: "node",
          globals: false,
          setupFiles: ["./src/test/setup-integration.ts"],
          include: ["src/**/*.integration.test.ts"],
          testTimeout: 30_000,
          hookTimeout: 30_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
