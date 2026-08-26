/**
 * Smoke render + DISTINCTNESS for every cdn-react demo
 * (frontend-guardrails §4.2: demos are first-class code — compiled, linted,
 * RENDERED).
 *
 * The second assertion is the one this package earned the hard way. The visual
 * pass found `cdn.single`'s two variants pixel-identical: `deduped` is only
 * read after a file is picked, so the one thing this pair exists for — bytes
 * the CDN already holds recognised BEFORE anything is sent — was invisible in
 * every shot of it, under two names. A variant that photographs the same frame
 * as another is worse than not declaring it, and this makes that a red test
 * rather than a screenshot review three waves later.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  assertVariantsRenderDistinctly,
  renderDemoVariant,
  variantIds,
} from "@stapel/showcase";
import type { DemoDef } from "@stapel/showcase";

const modules = import.meta.glob("../demo/*.demo.tsx", { eager: true }) as Record<
  string,
  { default: DemoDef }
>;

/** `<Image>` measures its own element; jsdom has no layout and no observer. */
class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe("cdn-react demos", () => {
  const entries = Object.entries(modules);

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", NoopResizeObserver);
    vi.stubGlobal("devicePixelRatio", 1);
  });

  it("discovers demos via glob", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  for (const [path, mod] of entries) {
    const demo = mod.default;

    it(`renders every variant of ${demo.id} (${path})`, () => {
      for (const id of variantIds(demo)) {
        const { container } = render(renderDemoVariant(demo, id));
        expect(container.firstChild).not.toBeNull();
      }
    });

    it(`${demo.id}: every variant shows something of its own`, () => {
      assertVariantsRenderDistinctly(demo, renderToStaticMarkup);
    });
  }
});
