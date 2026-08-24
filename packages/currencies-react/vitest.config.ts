import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    // jsdom has no matchMedia; antd and the shared skin both need one.
    setupFiles: ["./test/vitest.setup.ts"],
  },
});
