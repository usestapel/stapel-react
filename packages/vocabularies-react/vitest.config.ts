import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    // Full-CI runs the whole monorepo's suites in parallel (turbo); the default
    // 5s per-test budget flakes under that load. The first mount in a file pays
    // antd's one-time CSS-in-JS generation for every control the demo touches,
    // which is seconds in jsdom before a single assertion runs. Generous, not
    // permissive: a green test still resolves as fast as the state it awaits.
    // The matching `waitFor` budget lives in `test/vitest.setup.ts`, which is
    // where testing-library reads it from.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // jsdom has no matchMedia and no ResizeObserver; antd and the shared skin
    // need both, and antd 6 also calls the pseudo-element `getComputedStyle`
    // form that jsdom refuses.
    setupFiles: ["./test/vitest.setup.ts"],
  },
});
