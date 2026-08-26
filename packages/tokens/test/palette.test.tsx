/**
 * @vitest-environment jsdom
 *
 * Smoke render for the token palette auto-demo (frontend-guardrails §4, task 6).
 * Mounting it executes the enumeration over the generated token surface, so a
 * broken palette (or a token export rename) fails CI rather than the viewer.
 *
 * Beyond the smoke render this holds the three properties the page exists for:
 * it enumerates the WHOLE catalog, every cell copies a value it also prints,
 * and its grids stay multi-column at phone width.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { renderDemoVariant } from "@stapel/showcase";
import palette from "../demo/tokens-palette.demo.js";
import { colors, fontSize, radii, spacing } from "../src/index.js";
import { ramps } from "../src/generated/raw.js";

const rampSteps = Object.values(ramps).flatMap((steps) => Object.values(steps));

const expectedCells =
  Object.keys(colors).length +
  rampSteps.length +
  Object.keys(spacing).length +
  Object.keys(radii).length +
  Object.keys(fontSize).length;

describe("tokens palette demo", () => {
  it("renders the default variant", () => {
    const { container } = render(renderDemoVariant(palette, "default"));
    expect(container.firstChild).not.toBeNull();
  });

  it("enumerates the whole catalog as copyable cells", () => {
    const { container } = render(renderDemoVariant(palette, "default"));
    const cells = container.querySelectorAll("button[aria-label]");
    expect(cells.length).toBe(expectedCells);
  });

  it("names the token in every cell's accessible name", () => {
    const { container } = render(renderDemoVariant(palette, "default"));
    const labels = [...container.querySelectorAll("button[aria-label]")].map(
      (node) => node.getAttribute("aria-label") ?? "",
    );
    for (const name of Object.keys(colors)) {
      expect(labels.some((label) => label.includes(` ${name} `))).toBe(true);
    }
  });

  it("prints the literal hex of every ramp step", () => {
    const { container } = render(renderDemoVariant(palette, "default"));
    const text = container.textContent ?? "";
    for (const value of rampSteps) {
      expect(text).toContain(value);
    }
  });

  it("keeps every grid multi-column at phone width", () => {
    const { container } = render(renderDemoVariant(palette, "default"));
    const grids = [...container.querySelectorAll<HTMLElement>("div")].filter(
      (node) => node.style.gridTemplateColumns !== "",
    );
    expect(grids.length).toBeGreaterThan(0);
    for (const grid of grids) {
      // `minmax(min(<n>rem, 100%), 1fr)` is the form that still yields several
      // columns in a 390px viewport (a bare `minmax(9rem, 1fr)` collapsed the
      // page to one card per row — a 19,004px phone page).
      expect(grid.style.gridTemplateColumns).toMatch(
        /^repeat\(auto-fill, minmax\(min\(\d+(\.\d+)?rem, 100%\), 1fr\)\)$/,
      );
    }
  });
});
