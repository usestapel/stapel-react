import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    // Full-CI runs the whole monorepo's suites in parallel (turbo); default
    // 5s per-test / 1s waitFor budgets flake under that load. Generous, not
    // permissive: green tests still resolve as fast as the awaited state.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ["./test/vitest.setup.ts"],
    // auth-react is the largest jsdom suite; running its files across many
    // parallel forks WHILE turbo runs every other package's suite at once
    // pushed a jsdom worker to SIGSEGV (exit 139) on the release runner —
    // all tests PASS, a worker just crashes on teardown, failing the publish.
    // One forked process for this package: stable, fewer forks under the
    // aggregate load, only marginally slower (tests already pass in seconds).
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
