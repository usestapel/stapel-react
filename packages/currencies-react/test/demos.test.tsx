import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { renderDemoVariant, variantIds } from "@stapel/showcase";
import type { DemoDef } from "@stapel/showcase";

/**
 * Smoke render for every currencies-react demo (frontend-guardrails §4.2: demos
 * are first-class code — compiled, linted, RENDERED). Discovers demos by glob so
 * a new `*.demo.tsx` is covered automatically, mounts each default variant with
 * its mock harness, and asserts it renders without throwing.
 */
const modules = import.meta.glob("../demo/*.demo.tsx", { eager: true }) as Record<
  string,
  { default: DemoDef }
>;

/**
 * Mounted demos keep working after the assertion: every variant runs a real
 * TanStack query against the harness's canned fetch, and React schedules the
 * resolution on a later tick. Left mounted, that tick lands after vitest has
 * torn the jsdom `window` down — an "uncaught ReferenceError: window is not
 * defined" attributed to this file with no failing assertion in it. Unmount,
 * and let the pending microtasks flush inside the environment that owns them.
 */
afterEach(async () => {
  cleanup();
  await act(async () => {
    await Promise.resolve();
  });
});

describe("currencies-react demos", () => {
  const entries = Object.entries(modules);

  it("discovers demos via glob", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  for (const [path, mod] of entries) {
    const demo = mod.default;
    const first = variantIds(demo)[0];
    it(`renders ${demo.id} (${path})`, () => {
      expect(first).toBeDefined();
      if (!first) return;
      const { container } = render(renderDemoVariant(demo, first));
      expect(container.firstChild).not.toBeNull();
    });
  }
});
