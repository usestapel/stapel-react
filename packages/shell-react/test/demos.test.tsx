import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { renderDemoVariant, runDemoPlay, variantIds } from "@stapel/showcase";
import type { DemoDef } from "@stapel/showcase";

/**
 * Smoke render for every shell-react demo (frontend-guardrails §4.2: demos are
 * first-class code — compiled, linted, RENDERED). Discovers demos by glob so a
 * new `*.demo.tsx` is covered automatically.
 *
 * Every other pair in the fleet has had this file for waves; this one did not,
 * and it is exactly the gap the visual audit found: `app-shell--admin-blocked`
 * was photographed pixel-identical to `app-shell--default` — the state the
 * variant is named for was not reached by its render — and nothing in CI said
 * so.
 *
 * ── Why the distinctness check is not `assertVariantsRenderDistinctly` ──────
 *
 * That helper renders with `renderToStaticMarkup`, i.e. as a SERVER render,
 * and `useBreakpoint` answers `undefined` on a server because the server
 * cannot know the viewport. A shell's whole job is to branch on that answer:
 * every variant of every shell demo collapses to the same phone frame with its
 * sheet closed, and the check would pass or fail for reasons that have nothing
 * to do with the states. So the comparison here MOUNTS each variant, at the
 * width the variant declares it is designed for, and compares the DOM the
 * viewer would photograph. Same guard, one honest step stricter.
 */
const modules = import.meta.glob("../demo/*.demo.tsx", { eager: true }) as Record<
  string,
  { default: DemoDef }
>;

/** The three widths the showcase viewer offers (`.ladle/config.mjs`). */
const VIEWPORT_WIDTH = { phone: 390, tablet: 768, desktop: 1280 } as const;

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, writable: true });
  window.dispatchEvent(new Event("resize"));
}

/**
 * Mounted demos keep working after the assertion: a variant may still have a
 * transition in flight, and React schedules its resolution on a later tick.
 * Left mounted, that tick lands after vitest has torn the jsdom `window` down.
 */
afterEach(async () => {
  cleanup();
  await act(async () => {
    await Promise.resolve();
  });
});

/** The markup a variant paints at the width it is designed for — including
 * anything it portals into the document (a sheet is not inside its canvas). */
function paintedMarkup(demo: DemoDef, id: string): string {
  setViewportWidth(VIEWPORT_WIDTH[demo.variants[id]?.viewport ?? "desktop"]);
  const { container } = render(renderDemoVariant(demo, id));
  const markup = `${container.innerHTML}|${document.body.innerHTML.length.toString()}`;
  cleanup();
  return markup;
}

describe("shell-react demos", () => {
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
    // differ; when a state is only reachable by a click — or, as here, was
    // present in the DOM and clipped off the screen — the showcase
    // photographs one frame under several names, and the gap is invisible
    // exactly where it is being documented. A variant with a `play` step is
    // allowed to share its sibling's first frame: the step is what reaches
    // the state, and it is asserted below.
    const still = variantIds(demo).filter((id) => demo.variants[id]?.play === undefined);
    if (still.length > 1) {
      it(`paints each variant of ${demo.id} distinctly`, () => {
        const byMarkup = new Map<string, string[]>();
        for (const id of still) {
          const markup = paintedMarkup(demo, id);
          byMarkup.set(markup, [...(byMarkup.get(markup) ?? []), id]);
        }
        const duplicates = [...byMarkup.values()]
          .filter((ids) => ids.length > 1)
          .map((ids) => ids.join(" == "));
        expect(duplicates, `${demo.id}: variants painting identical DOM`).toEqual([]);
      });
    }

    for (const id of variantIds(demo)) {
      if (demo.variants[id]?.play === undefined) continue;
      it(`reaches ${demo.id} — ${id} through its play step`, async () => {
        setViewportWidth(VIEWPORT_WIDTH[demo.variants[id]?.viewport ?? "desktop"]);
        const { container } = render(renderDemoVariant(demo, id));
        await act(async () => {
          await runDemoPlay(demo, id, container as HTMLElement);
        });
      });
    }
  }
});
