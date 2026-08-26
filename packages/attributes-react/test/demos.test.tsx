/**
 * Smoke render for every attributes-react demo (frontend-guardrails §4.2:
 * demos are first-class code — compiled, linted, RENDERED). Discovers demos by
 * glob so a new `*.demo.tsx` is covered automatically, mounts each default
 * variant, and asserts it renders without throwing.
 */
import { describe, expect, it } from "vitest";
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

describe("attributes-react demos", () => {
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
      // claims five states while showing one. Every variant here opens
      // already seeded, and this is what proves it.
      assertVariantsRenderDistinctly(demo, renderToStaticMarkup);
    });
  }

  it("draws all ten builtin value types across the demo set", async () => {
    // The gate the brief asks for in one sentence: a demo suite that shows
    // eight of the ten types is a showcase with two undocumented editors, and
    // "someone will notice" is not a mechanism.
    const { BUILTIN_VALUE_EDITOR_TYPES } = await import("../src/default/editors.js");
    const fixtures = (await import("../demo/fixtures.js")) as Record<string, unknown>;
    const drawn = new Set<string>();
    for (const value of Object.values(fixtures)) {
      if (!Array.isArray(value)) continue;
      for (const entry of value) {
        const config = (entry as { config?: Record<string, unknown> } | null)?.config;
        const type = config?.["type"];
        if (typeof type === "string") drawn.add(type);
      }
    }
    for (const type of BUILTIN_VALUE_EDITOR_TYPES) {
      expect(drawn.has(type), `no demo fixture carries a "${type}" feature`).toBe(true);
    }
  });
});
