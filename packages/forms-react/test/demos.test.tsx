import { describe, expect, it } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import {
  assertVariantsRenderDistinctly,
  renderDemoVariant,
  variantIds,
} from "@stapel/showcase";
import type { DemoDef } from "@stapel/showcase";

/**
 * Smoke render for every forms-react demo (frontend-guardrails §4.2: demos
 * are first-class code — compiled, linted, RENDERED). Discovers demos by glob so
 * a new `*.demo.tsx` is covered automatically, mounts each default variant with
 * its mock harness, and asserts it renders without throwing.
 */
const modules = import.meta.glob("../demo/*.demo.tsx", { eager: true }) as Record<
  string,
  { default: DemoDef }
>;

/**
 * A jsdom renderer for the distinctness guard.
 *
 * `renderToStaticMarkup` walks ONE pass with no effects and no scheduler: it
 * never sees a query settle, a state update, or a layout effect. That is the
 * blind spot that let `forms-list`, `responses` and `public-form` ship green
 * here while photographing a blank page in the shot runner. Mounting in jsdom
 * takes the DOM the browser would actually paint.
 */
function jsdomMarkup(element: ReactElement): string {
  const view = render(element);
  const markup = view.container.innerHTML;
  view.unmount();
  return markup;
}

/** Mount a variant and let the harness's canned fetch settle, the way a real
 * viewer does before a shot is taken. */
async function settledMarkup(demo: DemoDef, variantId: string): Promise<string> {
  const view = render(renderDemoVariant(demo, variantId));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  const markup = view.container.innerHTML;
  view.unmount();
  return markup;
}

describe("forms-react demos", () => {
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

    // The C-SAMESHOT guard. A demo declares variants because the STATES
    // differ; when a state is only reachable by a click, every variant's
    // static render is the same idle frame and the gallery claims three
    // screens it never photographed. This is why the skin demos seed the
    // query cache instead of letting a fetch resolve.
    //
    // Run TWICE, against two renderers: the server pass catches a variant that
    // was never seeded at all, and the jsdom pass catches one whose seed is
    // overwritten once effects run — the failure a server pass cannot see.
    if (variantIds(demo).length > 1) {
      it(`renders each variant of ${demo.id} distinctly`, () => {
        assertVariantsRenderDistinctly(demo, renderToStaticMarkup);
        assertVariantsRenderDistinctly(demo, jsdomMarkup);
        cleanup();
      });
    }

    /**
     * The BLANK_RENDER guard, and the reason it is a separate async test.
     *
     * A screen can mount correctly and then erase itself: the demo's mock
     * fetch answers a path no handler claimed, the empty body lands in the
     * query cache on top of the seeded fixture, and the next render either
     * paints an empty state or throws spreading a non-array. Every check above
     * is synchronous, so all of them pass while the shot is one flat colour.
     * This one waits for the network the way the viewer does, then insists
     * each variant is still on screen and still its own picture.
     */
    it(`keeps every variant of ${demo.id} on screen after the network settles`, async () => {
      const byVariant = new Map<string, string>();
      for (const id of variantIds(demo)) {
        const markup = await settledMarkup(demo, id);
        expect(markup, `${demo.id}/${id} rendered nothing`).not.toBe("");
        byVariant.set(id, markup);
      }
      const distinct = new Set(byVariant.values());
      expect(
        distinct.size,
        `${demo.id}: variants collapsed onto the same DOM once the fetches settled`
      ).toBe(byVariant.size);
    });
  }
});
