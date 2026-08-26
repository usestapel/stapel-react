import { describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import {
  assertVariantsRenderDistinctly,
  renderDemoVariant,
  variantIds,
} from "@stapel/showcase";
import type { DemoDef } from "@stapel/showcase";
import type { ReactNode } from "react";

/**
 * Smoke render for every recordings-react demo (frontend-guardrails §4.2: demos
 * are first-class code — compiled, linted, RENDERED). Discovers demos by glob so
 * a new `*.demo.tsx` is covered automatically, mounts each default variant with
 * its mock harness, and asserts it renders without throwing.
 */
const modules = import.meta.glob("../demo/*.demo.tsx", { eager: true }) as Record<
  string,
  { default: DemoDef }
>;

/**
 * The renderer the distinctness check compares markup with: jsdom, not
 * `renderToStaticMarkup`, so anything a variant paints into a dialog portal
 * stays inside the comparison instead of being compared as two empty strings.
 */
function domMarkup(element: ReactNode): string {
  const { baseElement } = render(<>{element}</>);
  const html = baseElement.innerHTML;
  cleanup();
  return html;
}

describe("recordings-react demos", () => {
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

    // A demo declares variants because the states DIFFER. A variant whose named
    // state is only reachable by a click paints its sibling's first frame, and
    // the catalogue then photographs one screen under several names — worse
    // than declaring one, because the gap is invisible exactly where it is
    // being documented.
    it(`${demo.id} paints something different for every variant`, () => {
      assertVariantsRenderDistinctly(demo, domMarkup);
    });
  }
});
