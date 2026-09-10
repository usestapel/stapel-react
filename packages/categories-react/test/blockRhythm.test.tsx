/**
 * ONE GAP BETWEEN BLOCKS, AND NO BLOCK WITH AN OPINION OF ITS OWN — this
 * pair's half of the storefront's rhythm.
 *
 * A catalogue page is a stack of blocks: the breadcrumb, the heading, the
 * subcategory stage, the listings slot. Every gap between two of them used to
 * be `spacing[4]` written inline on whichever `<Flex>` wrapped them. Sixteen
 * pixels is a form's field spacing, not a page's section spacing, and the
 * walked storefront read as one column with no seams.
 *
 * The two properties are the SAME ones `@stapel/search-react` declares, on
 * purpose: a storefront that assembles a category screen out of both pairs
 * sets `--stapel-block-gap` once and both halves answer to it. That is why the
 * names are asserted here literally rather than read back off an import — a
 * contract nothing checks is a contract that drifts on the next rename.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { spacing } from "@stapel/tokens";
import {
  BLOCK_GAP_COMPACT_VAR,
  BLOCK_GAP_VAR,
  BLOCK_RHYTHM_CLASS,
  CatalogPage,
  blockRhythmCss,
} from "../src/default/index.js";
import type { BlockRhythm } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { FULL_PAGE } from "./fixtures.js";

const OK = {
  "/categories/carousel/": { body: [] },
  "/categories/": { body: FULL_PAGE },
};

async function mount(blockRhythm?: BlockRhythm): Promise<HTMLElement> {
  render(
    <TestProviders server={mockServer(OK)}>
      <CatalogPage
        {...(blockRhythm !== undefined ? { blockRhythm } : {})}
      />
    </TestProviders>
  );
  await waitFor(() => {
    expect(screen.getByTestId("categories-catalog-page")).toBeTruthy();
  });
  return screen.getByTestId("categories-catalog-page");
}

/** The page's own blocks — a hoisted `<style>` is `display: none` and is not
 * one of them. */
function blocks(page: HTMLElement): readonly HTMLElement[] {
  return [...page.children].filter(
    (node): node is HTMLElement =>
      node instanceof HTMLElement && node.tagName !== "STYLE"
  );
}

describe("the catalogue page's blocks are spaced by the token", () => {
  it("carries the rhythm class and writes no inline gap", async () => {
    const page = await mount();
    expect(page.dataset["rhythm"]).toBe("token");
    expect(page.classList.contains(BLOCK_RHYTHM_CLASS)).toBe(true);
    // An inline `gap` would beat the sheet, which is where the token and its
    // compact arm live.
    expect(page.style.gap).toBe("");
  });

  it("states the SAME two property names the search pair declares", () => {
    expect(BLOCK_GAP_VAR).toBe("--stapel-block-gap");
    expect(BLOCK_GAP_COMPACT_VAR).toBe("--stapel-block-gap-compact");
    const css = blockRhythmCss();
    expect(css).toContain(
      `.${BLOCK_RHYTHM_CLASS}{gap:var(${BLOCK_GAP_VAR},${String(spacing[6])}px)}`
    );
    expect(css).toContain("@media (pointer:coarse),(max-width:767px)");
    expect(css).toContain(
      `gap:var(${BLOCK_GAP_COMPACT_VAR},${String(spacing[5])}px)`
    );
  });

  it("leaves no block carrying an outer margin of its own", async () => {
    const page = await mount();
    // Unset or an explicit zero: a `margin: 0` is a block REFUSING a margin
    // the design system would otherwise give it (a heading's own), which is
    // the same answer as writing nothing. Any other value is a second opinion
    // about the distance the gap already states.
    const NONE = ["", "0", "0px"];
    for (const block of blocks(page)) {
      for (const property of [
        "margin",
        "marginTop",
        "marginBottom",
        "marginBlock",
      ] as const) {
        expect(
          NONE,
          `a block states its own ${property}: ${block.style[property]}`
        ).toContain(block.style[property]);
      }
    }
    expect(blockRhythmCss()).toContain(`.${BLOCK_RHYTHM_CLASS}>*{margin-block:0}`);
  });

  it('restores the flat inline gap under "legacy"', async () => {
    const page = await mount("legacy");
    expect(page.dataset["rhythm"]).toBe("legacy");
    expect(page.classList.contains(BLOCK_RHYTHM_CLASS)).toBe(false);
    expect(page.style.gap).toBe(`${String(spacing[4])}px`);
  });
});
