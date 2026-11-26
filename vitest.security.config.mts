import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["tests/security/**/*.test.ts"],
    fileParallelism: false,          // shared mock-AI mode
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
