/**
 * @vitest-environment jsdom
 *
 * Smoke render for the token palette auto-demo (frontend-guardrails §4, task 6).
 * Mounting it executes the enumeration over the generated token surface, so a
 * broken palette (or a token export rename) fails CI rather than the viewer.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { renderDemoVariant } from "@stapel/showcase";
import palette from "../demo/tokens-palette.demo.js";

describe("tokens palette demo", () => {
  it("renders the default variant", () => {
    const { container } = render(renderDemoVariant(palette, "default"));
    expect(container.firstChild).not.toBeNull();
    // The palette enumerates the catalog — expect many swatches.
    expect(container.querySelectorAll("code").length).toBeGreaterThan(20);
  });
});
