import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    // jsdom has no matchMedia and no ResizeObserver; antd, the shared skin and
    // dnd-kit all need both.
    setupFiles: ["./test/vitest.setup.ts"],
  },
});
