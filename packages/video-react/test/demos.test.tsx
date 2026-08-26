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
 * Smoke render for every video-react demo (frontend-guardrails §4.2: demos
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
 * jsdom rather than `renderToStaticMarkup`: the lobby's "turn away" question is
 * a `SkinConfirm`, antd renders it through a portal, and React's server
 * renderer refuses portals outright. Reading `document.body` keeps whatever a
 * variant painted into one inside the comparison.
 */
function domMarkup(element: ReactNode): string {
  const { baseElement } = render(<>{element}</>);
  const html = baseElement.innerHTML;
  cleanup();
  return html;
}

describe("video-react demos", () => {
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

    // A demo declares variants because the states DIFFER. Two of this
    // package's used to be `default` rendered a second time under the name
    // `phone` — the responsive switch here is driven by the pane's own width,
    // so the second variant photographed the identical frame and the catalogue
    // claimed a screen it had never shown.
    it(`${demo.id} paints something different for every variant`, () => {
      assertVariantsRenderDistinctly(demo, domMarkup);
    });
  }
});
