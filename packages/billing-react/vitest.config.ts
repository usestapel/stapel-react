import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    // Full-CI runs the whole monorepo's suites in parallel (turbo); default
    // 5s per-test / 1s waitFor budgets flake under that load. Generous, not
    // permissive: green tests still resolve as fast as the awaited state.
    //
    // Raised to 60s in wave B: `<WalletPanel/>` now mounts five antd surfaces
    // at once (statistic, cards, form controls, a confirm dialog, a ledger),
    // and the FIRST render in a file pays antd's one-time CSS-in-JS
    // generation for every one of them — ~16s in jsdom on a loaded runner,
    // against ~0.2s for each render after it. The budget is sized for that
    // warmup, not for the assertions.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    setupFiles: ["./test/vitest.setup.ts"],
  },
});
