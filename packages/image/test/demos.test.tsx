/**
 * Smoke render + distinctness for every `@stapel/image` demo
 * (frontend-guardrails §4.2: demos are first-class code — compiled, linted,
 * RENDERED).
 *
 * The second assertion is the one that matters here. Six of these variants
 * document states that differ only in metadata — a poster is not a blur, a
 * reserved box is not a painted one — and a variant whose static render is
 * byte-identical to another's photographs the same frame under two names,
 * which is worse than declaring one. `assertVariantsRenderDistinctly` makes
 * that a red test here rather than a screenshot review three waves later.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
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

class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe("image demos", () => {
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
