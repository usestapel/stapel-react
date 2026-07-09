import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.js"],
    // Full-CI runs the whole monorepo's suites in parallel (turbo); default
    // 5s per-test / 1s waitFor budgets flake under that load. Generous, not
    // permissive: green tests still resolve as fast as the awaited state.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
