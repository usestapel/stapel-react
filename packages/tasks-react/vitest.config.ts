import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    // Full-CI runs the whole monorepo's suites in parallel (turbo); the default
    // 5s per-test budget flakes under that load, and this package is one of the
    // heaviest renders in the fleet — the first mount in a file pays antd's
    // one-time CSS-in-JS generation for a board, a sheet, a confirm and a
    // dozen form controls, which is seconds in jsdom before a single assertion
    // runs. Generous, not permissive: a green test still resolves as fast as
    // the state it awaits. The matching `waitFor` budget lives in
    // `test/vitest.setup.ts`, which is where testing-library reads it from.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // jsdom has no matchMedia and no ResizeObserver; antd, the shared skin and
    // dnd-kit all need both.
    setupFiles: ["./test/vitest.setup.ts"],
  },
});
