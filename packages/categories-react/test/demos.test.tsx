import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  assertVariantsRenderDistinctly,
  renderDemoVariant,
  variantIds,
} from "@stapel/showcase";
import type { DemoDef } from "@stapel/showcase";

/**
 * Smoke render for every categories-react demo (frontend-guardrails §4.2: demos
 * are first-class code — compiled, linted, RENDERED). Discovers demos by glob so
 * a new `*.demo.tsx` is covered automatically, mounts each default variant with
 * its mock harness, and asserts it renders without throwing.
 */
const modules = import.meta.glob("../demo/*.demo.tsx", { eager: true }) as Record<
  string,
  { default: DemoDef }
>;

describe("categories-react demos", () => {
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

    it(`${demo.id} photographs a different frame per variant`, () => {
      // C-SAMESHOT: a variant whose named state is only reachable by a click
      // renders the SAME idle frame as its siblings, and the showcase then
      // claims five states while showing one. Every variant here is SEEDED
      // into the query cache instead, so the static render already is the
      // state the variant is named for — and this is what proves it.
      assertVariantsRenderDistinctly(demo, renderToStaticMarkup);
    });
  }
});
