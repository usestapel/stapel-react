import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  assertVariantsRenderDistinctly,
  renderDemoVariant,
  variantIds,
} from "@stapel/showcase";
import type { DemoDef } from "@stapel/showcase";

/**
 * Smoke render for every translate-react demo (frontend-guardrails §4.2: demos
 * are first-class code — compiled, linted, RENDERED). Discovers demos by glob so
 * a new `*.demo.tsx` is covered automatically, mounts each default variant with
 * its mock harness, and asserts it renders without throwing.
 */
const modules = import.meta.glob("../demo/*.demo.tsx", { eager: true }) as Record<
  string,
  { default: DemoDef }
>;

/**
 * Mounted demos keep working after the assertion: a variant may still have a
 * request in flight, and React schedules its resolution on a later tick. Left
 * mounted, that tick lands after vitest has torn the jsdom `window` down.
 */
afterEach(async () => {
  cleanup();
  await act(async () => {
    await Promise.resolve();
  });
});

describe("translate-react demos", () => {
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

    // The C-SAMESHOT guard (the runtime half of the skin gate's `step` check).
    // A demo declares variants because the STATES differ; when a state is only
    // reachable by a click, every variant's static render is the same idle
    // frame and the gallery claims screens it never photographed. This is why
    // the skin demos SEED their state (a literal bag, a published loader
    // status) instead of waiting for a mocked fetch.
    if (variantIds(demo).length > 1) {
      it(`renders each variant of ${demo.id} distinctly`, () => {
        assertVariantsRenderDistinctly(demo, renderToStaticMarkup);
      });
    }
  }
});
