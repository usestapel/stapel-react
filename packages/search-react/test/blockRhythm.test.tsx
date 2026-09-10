/**
 * ONE GAP BETWEEN BLOCKS, AND NO BLOCK WITH AN OPINION OF ITS OWN.
 *
 * The assembled page is a stack of blocks — the query box, the breadcrumb, the
 * location row, the header band, the applied chips, the columns — and the
 * distance between two of them used to be `spacing[4]` written inline on the
 * root `<Flex>` plus whatever outer margin the block itself carried. Sixteen
 * pixels is what a form's fields are spaced by, not what a page's sections
 * are: the walked storefront read as one column with no seams, and the owner's
 * word for it was that everything is stuck together.
 *
 * What is asserted: that the gap comes from the TOKEN and not from an inline
 * number (an inline `gap` would beat the sheet, which is the whole reason the
 * root stops writing one), that the compact arm exists for a coarse pointer
 * and a narrow window, and that no block on the page carries an outer margin
 * of its own — a second opinion about the same distance is how a page ends up
 * with four spacings nobody chose.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { spacing } from "@stapel/tokens";
import {
  BLOCK_GAP_COMPACT_VAR,
  BLOCK_GAP_VAR,
  BLOCK_RHYTHM_CLASS,
  SearchPage,
  blockRhythmCss,
} from "../src/default/index.js";
import type { SearchBlockRhythm } from "../src/default/index.js";
import type { SearchParamsAdapter } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import {
  DESKTOP_WIDTH,
  TestProviders,
  mockServer,
  setViewport,
  useTestParams,
} from "./harness.js";

const RAIL_WIDTH = 1024;

afterEach(() => {
  cleanup();
  setViewport(DESKTOP_WIDTH);
});

function server() {
  return mockServer({
    "/query": { body: searchResponse({ facets: { brand: { bosch: 12 } } }) },
  });
}

function Page(props: { readonly blockRhythm?: SearchBlockRhythm }): ReactElement {
  const adapter: SearchParamsAdapter = useTestParams("type=listing");
  return (
    <SearchPage
      adapter={adapter}
      defaultType="listing"
      railFrom={RAIL_WIDTH}
      breadcrumb={<span>catalogue</span>}
      resultsHeader={<span>header band</span>}
      {...(props.blockRhythm !== undefined
        ? { blockRhythm: props.blockRhythm }
        : {})}
    />
  );
}

async function mount(props: Parameters<typeof Page>[0] = {}): Promise<HTMLElement> {
  setViewport(RAIL_WIDTH);
  render(
    <TestProviders server={server()}>
      <Page {...props} />
    </TestProviders>
  );
  await waitFor(() => {
    expect(screen.getByTestId("search-results")).toBeTruthy();
  });
  return screen.getByTestId("search-page");
}

/** The page's own blocks: the direct children that take part in the layout.
 * A hoisted `<style>` is `display: none` and is not one of them. */
function blocks(page: HTMLElement): readonly HTMLElement[] {
  return [...page.children].filter(
    (node): node is HTMLElement =>
      node instanceof HTMLElement && node.tagName !== "STYLE"
  );
}

describe("<SearchPage blockRhythm> — the gap is a token", () => {
  it("spaces the blocks from the rhythm class, not from an inline number", async () => {
    const page = await mount();
    expect(page.dataset["rhythm"]).toBe("token");
    expect(page.classList.contains(BLOCK_RHYTHM_CLASS)).toBe(true);
    // The root writes NO inline gap: an inline declaration beats the sheet,
    // and the sheet is where the token and its compact arm live.
    expect(page.style.gap).toBe("");
  });

  it("reads one property per pointer, defaulting to the spacing scale", () => {
    const css = blockRhythmCss();
    expect(css).toContain(
      `.${BLOCK_RHYTHM_CLASS}{gap:var(${BLOCK_GAP_VAR},${String(spacing[6])}px)}`
    );
    // A coarse pointer OR a narrow window — a tablet held in a hand is a phone
    // for this purpose whatever its width reports.
    expect(css).toContain("@media (pointer:coarse),(max-width:767px)");
    expect(css).toContain(
      `gap:var(${BLOCK_GAP_COMPACT_VAR},${String(spacing[5])}px)`
    );
    // The numbers are the design system's steps, not two values picked by eye.
    expect(spacing[6]).toBe(32);
    expect(spacing[5]).toBe(24);
  });

  it("leaves no block carrying an outer margin of its own", async () => {
    const page = await mount();
    const drawn = blocks(page);
    // The page really is an assembly: box, breadcrumb, header band, columns.
    expect(drawn.length).toBeGreaterThan(2);
    // Unset or an explicit zero: a `margin: 0` is a block REFUSING the margin
    // the design system would otherwise give it, which is the same answer as
    // writing nothing. Any other value is a second opinion about a distance
    // the gap already states.
    const NONE = ["", "0", "0px"];
    for (const block of drawn) {
      for (const property of [
        "margin",
        "marginTop",
        "marginBottom",
        "marginBlock",
        "marginBlockStart",
        "marginBlockEnd",
      ] as const) {
        expect(
          NONE,
          `block ${block.dataset["testid"] ?? block.tagName} states its own ` +
            `${property}: ${block.style[property]}`
        ).toContain(block.style[property]);
      }
    }
    // And a block that inherits one from the design system loses it too: the
    // reset is the other half of "the distance is ONE number".
    expect(blockRhythmCss()).toContain(`.${BLOCK_RHYTHM_CLASS}>*{margin-block:0}`);
  });
});

describe('<SearchPage blockRhythm="legacy">', () => {
  it("restores the flat inline gap for a host measured against it", async () => {
    const page = await mount({ blockRhythm: "legacy" });
    expect(page.dataset["rhythm"]).toBe("legacy");
    expect(page.classList.contains(BLOCK_RHYTHM_CLASS)).toBe(false);
    expect(page.style.gap).toBe(`${String(spacing[4])}px`);
  });
});
