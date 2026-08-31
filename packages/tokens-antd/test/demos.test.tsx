// @vitest-environment jsdom
/**
 * Smoke render for every tokens-antd demo (frontend-guardrails §4.2: demos are
 * first-class code — compiled, linted, RENDERED). Discovers demos by glob so a
 * new `*.demo.tsx` is covered automatically, mounts each variant, and asserts
 * that the four states the showcase CLAIMS are four states it actually draws.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  assertVariantsRenderDistinctly,
  renderDemoVariant,
  variantIds,
} from "@stapel/showcase";
import type { DemoDef } from "@stapel/showcase";
import { installMatchMedia, setViewport } from "./env.js";

const modules = import.meta.glob("../demo/*.demo.tsx", { eager: true }) as Record<
  string,
  { default: DemoDef }
>;

beforeEach(() => {
  installMatchMedia();
  setViewport(390);
});

describe("tokens-antd demos", () => {
  const entries = Object.entries(modules);

  it("discovers demos via glob", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  for (const [path, mod] of entries) {
    const demo = mod.default;
    for (const variant of variantIds(demo)) {
      it(`renders ${demo.id} — ${variant} (${path})`, () => {
        const { container } = render(renderDemoVariant(demo, variant));
        expect(container.firstChild).not.toBeNull();
      });
    }

    it(`${demo.id} photographs a different frame per variant`, () => {
      // C-SAMESHOT: a showcase that names four states and draws one is worse
      // than a showcase with one state, because the reviewer believes it.
      assertVariantsRenderDistinctly(demo, renderToStaticMarkup);
    });
  }
});
