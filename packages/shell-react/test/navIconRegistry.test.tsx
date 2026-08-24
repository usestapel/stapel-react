/**
 * `resolveNavIcon` — the registry in `src/default/icons.tsx` that resolves
 * a `NavEntry.icon` NAME to an actual glyph. The property under test is not
 * "the function was called" but the real user-visible contract: every icon
 * name a pair in THIS monorepo actually declares must resolve to a real
 * glyph, not the generic fallback square — a pair adding a new icon name
 * without the registry growing a case for it is a FAILING test here, not a
 * silent "□" on someone's live nav bar.
 *
 * The required name list is read straight from the repo's generated,
 * drift-gated root `nav-manifest.json` (`scripts/gen-nav-manifest.mjs`,
 * `pnpm gen:nav:check`) — the same source of truth every pair's own
 * `nav-manifest.json` feeds — so a new pair wiring a new icon name is
 * covered automatically, with no hand-maintained list to fall out of date.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { resolveNavIcon } from "../src/default/icons.js";

// vitest runs from the package root, so a cwd-relative path is stable
// across node/jsdom (jsdom's import.meta.url is not a file:// URL — see
// billing-react/test/pair.test.ts for the same convention).
const ROOT_NAV_MANIFEST = "../../nav-manifest.json";

interface GeneratedNavManifest {
  readonly packages: ReadonlyArray<{
    readonly package: string;
    readonly entries: ReadonlyArray<{ readonly icon: string }>;
  }>;
}

function declaredIconNames(): readonly string[] {
  const manifest = JSON.parse(readFileSync(ROOT_NAV_MANIFEST, "utf-8")) as GeneratedNavManifest;
  const names = new Set<string>();
  for (const pkg of manifest.packages) {
    for (const entry of pkg.entries) {
      names.add(entry.icon);
    }
  }
  return [...names].sort();
}

function renderedMarkup(name: string): string {
  const { container } = render(resolveNavIcon(name));
  return container.innerHTML;
}

describe("resolveNavIcon — coverage of every icon name the monorepo's own pairs declare", () => {
  const fallbackMarkup = renderedMarkup("NoSuchIconOutlined");

  it("reads at least one icon name from the generated root nav-manifest.json (sanity check on the fixture itself)", () => {
    expect(declaredIconNames().length).toBeGreaterThan(0);
  });

  it.each(declaredIconNames())("resolves %s to a real glyph, not the fallback square", (name) => {
    expect(renderedMarkup(name)).not.toBe(fallbackMarkup);
  });

  it("falls back to the generic square for a name no pair in this monorepo declares", () => {
    const { container } = render(resolveNavIcon("NoSuchIconOutlined"));
    const rect = container.querySelector("rect");
    expect(rect).not.toBeNull();
    expect(rect?.getAttribute("x")).toBe("5");
    expect(rect?.getAttribute("y")).toBe("5");
    expect(rect?.getAttribute("width")).toBe("14");
    expect(rect?.getAttribute("height")).toBe("14");
  });

  it("resolves the same fallback square for two different unknown names (proves it's the generic case, not a coincidence)", () => {
    expect(renderedMarkup("AnotherUnknownOutlined")).toBe(fallbackMarkup);
  });
});
