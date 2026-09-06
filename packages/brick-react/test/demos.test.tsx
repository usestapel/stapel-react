import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { renderDemoVariant, runDemoPlay, variantIds } from "@stapel/showcase";
import type { DemoDef } from "@stapel/showcase";

/**
 * Smoke render for every brick-react demo (frontend-guardrails §4.2: demos are
 * first-class code — compiled, linted, RENDERED), plus the C-SAMESHOT guard: a
 * demo declares variants because the states differ, and six games that all
 * painted the same board would be six photographs of one screen.
 *
 * The comparison MOUNTS each variant rather than server-rendering it: the
 * console reads `matchMedia` in an effect, and a server render answers that
 * question with silence — every variant would collapse to the same keypad-less
 * frame and the check would pass for a reason that has nothing to do with the
 * games.
 */
const modules = import.meta.glob("../demo/*.demo.tsx", { eager: true }) as Record<
  string,
  { default: DemoDef }
>;

const VIEWPORT_WIDTH = { phone: 390, tablet: 768, desktop: 1280 } as const;

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, writable: true });
  window.dispatchEvent(new Event("resize"));
}

afterEach(async () => {
  cleanup();
  await act(async () => {
    await Promise.resolve();
  });
});

function paintedMarkup(demo: DemoDef, id: string): string {
  setViewportWidth(VIEWPORT_WIDTH[demo.variants[id]?.viewport ?? "desktop"]);
  const { container } = render(renderDemoVariant(demo, id));
  const markup = container.innerHTML;
  cleanup();
  return markup;
}

describe("brick-react demos", () => {
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
