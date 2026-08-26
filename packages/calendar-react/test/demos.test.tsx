import { describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { assertVariantsRenderDistinctly, renderDemoVariant, variantIds } from "@stapel/showcase";
import type { DemoDef } from "@stapel/showcase";
import type { ReactNode } from "react";

/**
 * Smoke render for every calendar-react demo (frontend-guardrails §4.2: demos
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
 * Sibling pairs pass `renderToStaticMarkup`; this one cannot. Half of this
 * package's skin surfaces ARE dialogs (`EventSheet`, `EventEditorSheet`, the
 * delete confirmation), antd renders those through a portal, and React's
 * server renderer refuses portals outright ("Portals are not currently
 * supported by the server renderer"). Rendering into jsdom and reading
 * `document.body` keeps the sheet in the comparison instead of comparing two
 * empty strings and calling them distinct — the injected-renderer seam
 * (`MarkupRenderer`) exists for exactly this.
 */
function domMarkup(element: ReactNode): string {
  const { baseElement } = render(<>{element}</>);
  const html = baseElement.innerHTML;
  cleanup();
  return html;
}

describe("calendar-react demos", () => {
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
      // A demo paints EITHER in place or into a dialog portal (this pair's
      // sheets are half its skin surfaces), so "something rendered" is the
      // union of the two — asserting only `container` would call an open
      // bottom sheet an empty render.
      const painted =
        container.firstChild !== null ||
        baseElement.querySelector("[data-stapel-dialog-surface]") !== null;
      expect(painted).toBe(true);
    });

    // A demo declares variants because the states DIFFER. When the named state
    // is only reachable by a click, every variant paints the same first frame
    // and the catalogue photographs one screen under several names — worse than
    // declaring one, because the gap is invisible exactly where it is being
    // documented. Every variant here seeds its state instead (a query answer, a
    // refusal, a controlled prop), and this is what proves it.
    it(`${demo.id} paints something different for every variant`, () => {
      assertVariantsRenderDistinctly(demo, domMarkup);
    });
  }
});
