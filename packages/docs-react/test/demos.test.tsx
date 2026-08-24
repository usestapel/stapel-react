/**
 * Smoke render for every docs-react demo (frontend-guardrails §4.2: demos are
 * first-class code — compiled, linted, RENDERED), plus the distinctness guard.
 *
 * The second half is the C-SAMESHOT guard, in the only form that can tell the
 * truth here. `assertVariantsRenderDistinctly` compares RENDERED markup, and
 * every surface in this pair is query-driven: a synchronous static render is
 * the loading skeleton for all of them, so the byte comparison would report
 * ten false collisions and prove nothing. What CAN be asserted statically is
 * that each variant is seeded at a state of its own — a distinct
 * (`step`, `viewport`) pair — which is what the showcase's shot runner reads
 * and asserts against the frame it photographs. The rendered half belongs to a
 * runner that can await the fetch; noted in the wave's REQUESTS file.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { renderDemoVariant, variantIds } from "@stapel/showcase";
import type { DemoDef } from "@stapel/showcase";

const modules = import.meta.glob("../demo/*.demo.tsx", { eager: true }) as Record<
  string,
  { default: DemoDef }
>;

describe("docs-react demos", () => {
  const entries = Object.entries(modules);

  it("discovers demos via glob", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  for (const [path, mod] of entries) {
    const demo = mod.default;
    const first = variantIds(demo)[0];

    it(`renders ${demo.id} (${path})`, () => {
      expect(first).toBeDefined();
      if (first === undefined) return;
      const { container, baseElement } = render(renderDemoVariant(demo, first));
      // A demo whose surface is a DIALOG renders through a portal into
      // document.body, so its own container is legitimately empty — asserting
      // only on `container` would fail the one demo that documents the sheet.
      const portalled = baseElement.querySelector("[data-stapel-dialog-surface]");
      expect(container.firstChild !== null || portalled !== null).toBe(true);
    });

    it(`${demo.id}: every variant is seeded at a state of its own`, () => {
      const seeds = Object.entries(demo.variants).map(([id, variant]) => {
        // A variant with no declared step is a variant a shot runner cannot
        // assert it photographed — the static half of the C-SAMESHOT defect.
        expect(variant.step, `${demo.id}.${id} declares no step`).toBeTypeOf(
          "string"
        );
        return `${String(variant.step)}@${String(variant.viewport)}`;
      });
      // The same state at two widths is a real pair of variants; the same
      // state at the same width twice is one screen under two names.
      expect(new Set(seeds).size).toBe(seeds.length);
    });

    it(`${demo.id}: at least one variant is drawn at phone width`, () => {
      expect(
        Object.values(demo.variants).some((v) => v.viewport === "phone")
      ).toBe(true);
    });
  }
});
