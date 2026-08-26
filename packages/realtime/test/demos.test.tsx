/**
 * Smoke render for every `@stapel/realtime` demo, plus the one assertion the
 * showcase cannot make for a socket: that each variant reaches the state it is
 * NAMED for.
 *
 * `assertVariantsRenderDistinctly` — the static guard the other pairs use —
 * says nothing here on purpose. These variants are driven by frames that
 * arrive in a microtask, so a synchronous `renderToStaticMarkup` photographs
 * the same first paint six times whatever the scripts do. The state has to be
 * awaited, and once it is awaited the honest assertion is stronger than
 * "different": the badge exposes the state it decided on, and this pins each
 * variant to its own.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { renderDemoVariant, variantIds } from "@stapel/showcase";
import type { DemoDef } from "@stapel/showcase";
import demo from "../demo/Realtime.demo.js";

/** The badge state each variant exists to document. */
const EXPECTED: Record<string, string> = {
  connecting: "connecting",
  live: "live",
  reconnecting: "reconnecting-long",
  unavailable: "never-connected",
  resync: "resync",
  refused: "refused-revoked",
};

describe("realtime demos", () => {
  const def: DemoDef = demo;

  it("documents every variant this test knows about", () => {
    expect([...variantIds(def)].sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const id of variantIds(def)) {
    it(`${id}: the badge reaches its named state`, async () => {
      const { unmount } = render(renderDemoVariant(def, id));
      await waitFor(() => {
        expect(screen.getByRole("status").getAttribute("data-stapel-live-state")).toBe(
          EXPECTED[id]
        );
      });
      unmount();
    });
  }
});
