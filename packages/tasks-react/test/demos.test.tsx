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
 * Smoke render for every tasks-react demo (frontend-guardrails §4.2: demos
 * are first-class code — compiled, linted, RENDERED). Discovers demos by glob so
 * a new `*.demo.tsx` is covered automatically, mounts each default variant with
 * its mock harness, and asserts it renders without throwing.
 */
const modules = import.meta.glob("../demo/*.demo.tsx", { eager: true }) as Record<
  string,
  { default: DemoDef }
>;

/**
 * The renderer the distinctness check compares markup with.
 *
 * `renderToStaticMarkup` cannot be used here: three of this package's five
 * surfaces are dialogs (`TaskSheet`, `BoardCreateSheet`, the archive confirm),
 * antd renders those through a portal, and React's server renderer refuses
 * portals outright. Rendering into jsdom and reading `document.body` keeps the
 * sheet inside the comparison instead of comparing two empty strings and
 * calling them distinct — the injected-renderer seam exists for exactly this.
 */
function domMarkup(element: ReactNode): string {
  const { baseElement } = render(<>{element}</>);
  const html = baseElement.innerHTML;
  cleanup();
  return html;
}

describe("tasks-react demos", () => {
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
      const { container, baseElement } = render(renderDemoVariant(demo, first));
      // A demo paints EITHER in place or into a dialog portal, so "something
      // rendered" is the union of the two — asserting only `container` would
      // call an open bottom sheet an empty render.
      const painted =
        container.firstChild !== null ||
        baseElement.querySelector("[data-stapel-dialog-surface]") !== null;
      expect(painted).toBe(true);
    });

    // A demo declares variants because the states DIFFER. Where the named state
    // is only reachable by a click — or is drawn by a component that renders
    // nothing in a production build — every variant paints the same frame and
    // the catalogue photographs one screen under several names. The visual pass
    // found six such pairs in this package alone; this is what keeps them from
    // coming back.
    it(`${demo.id} paints something different for every variant`, () => {
      assertVariantsRenderDistinctly(demo, domMarkup);
    });
  }
});
