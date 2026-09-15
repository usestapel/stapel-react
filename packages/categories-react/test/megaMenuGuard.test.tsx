/**
 * WHERE THE MEGA-MENU'S GUARD SITS — the boundary widths, and only those.
 *
 * `minWidth` was defaulted to a hard-coded `1024`: a number on no rung of
 * `@stapel/tokens` that happened to equal one deployment's private edge, so
 * every host that named nothing inherited one storefront's composition. The
 * default is now `breakpoints.desktop`; a deployment that opens its catalogue
 * button earlier passes its own width, and passes the same one it gives every
 * other pair.
 *
 * Written at the EDGES. 1199/1200 is the assertion that means something now;
 * 1023/1024 is the assertion that the OLD edge is gone, and it is the one that
 * would have caught this being quietly restored. 767/768 says the tablet rung
 * is not it either — the panel is not a tablet surface.
 *
 * Each case prints its markers, so a run is evidence and not only a verdict.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { breakpoints } from "@stapel/tokens";
import { CategoryMegaMenu } from "../src/default/index.js";
import {
  DESKTOP_WIDTH,
  TestProviders,
  installViewport,
  mockServer,
  resetViewportListeners,
  setViewport,
} from "./harness.js";
import { TREE } from "./fixtures.js";

const OK = { "/tree/": { body: TREE } };

/** Both sides of both candidate edges, and both sides of the tablet rung. */
const WIDTHS = [767, 768, 1023, 1024, 1199, 1200] as const;

beforeAll(() => {
  installViewport();
});
beforeEach(() => {
  resetViewportListeners();
  setViewport(DESKTOP_WIDTH);
});

interface GuardMarkers {
  readonly width: number;
  /** Is the panel on the page at all? */
  readonly panel: boolean;
  /** Did it ask the server for the tree? A panel nobody may see must not pay
   * for the rows it would hide, so this must move WITH the panel. */
  readonly treeRead: boolean;
}

async function markersAt(
  width: number,
  props: Partial<Parameters<typeof CategoryMegaMenu>[0]> = {}
): Promise<GuardMarkers> {
  setViewport(width);
  const server = mockServer(OK);
  render(
    <TestProviders server={server}>
      <CategoryMegaMenu {...props} />
    </TestProviders>
  );
  // Settle either way, and WAIT for the positive case: above the guard the
  // panel draws only once the tree read lands, so a single microtask would
  // report every width as "absent" and the table would agree with itself
  // while proving nothing. A bounded wait that times out IS the negative
  // answer — below the guard nothing is ever coming.
  await act(async () => {
    await Promise.resolve();
  });
  let panel = false;
  try {
    await waitFor(
      () => {
        expect(screen.getByTestId("categories-mega-menu")).toBeTruthy();
      },
      { timeout: 600 }
    );
    panel = true;
  } catch {
    panel = false;
  }
  const markers: GuardMarkers = {
    width,
    panel,
    treeRead: server.calls.some((call) => call.url.includes("/tree/")),
  };
  cleanup();
  return markers;
}

function table(rows: readonly GuardMarkers[]): string {
  const head = "width  panel  treeRead";
  return [
    head,
    ...rows.map(
      (row) =>
        `${String(row.width).padEnd(5)}  ${String(row.panel).padEnd(5)}  ${String(
          row.treeRead
        )}`
    ),
  ].join("\n");
}

describe("<CategoryMegaMenu> — the guard is the tokens' desktop rung", () => {
  it("appears from breakpoints.desktop and nowhere below it", async () => {
    const rows: GuardMarkers[] = [];
    for (const width of WIDTHS) rows.push(await markersAt(width));
    console.log(`\n<CategoryMegaMenu/> default guard\n${table(rows)}`);

    const at = (width: number): GuardMarkers => {
      const row = rows.find((candidate) => candidate.width === width);
      if (row === undefined) throw new Error(`no row at ${String(width)}`);
      return row;
    };

    // The default IS the rung, not a number that happens to equal it today.
    expect(breakpoints.desktop).toBe(1200);

    // Below it: nothing drawn, and nothing fetched.
    for (const width of [767, 768, 1023, 1024, 1199]) {
      expect(at(width).panel, `panel at ${String(width)}`).toBe(false);
      expect(at(width).treeRead, `tree read at ${String(width)}`).toBe(false);
    }
    // 1024 specifically: the OLD default. A panel here means the literal came
    // back, whatever the constant now says.
    expect(at(1024).panel).toBe(false);

    expect(at(1200).panel).toBe(true);
    expect(at(1200).treeRead).toBe(true);
  });

  it("takes a deployment's own edge, and asks the server only from there", async () => {
    // The fleet storefront's `SERP_RAIL_MIN_WIDTH` — the one number that
    // deployment names once and hands to every pair (`railFrom`, `chromeFrom`,
    // and this).
    const rows: GuardMarkers[] = [];
    for (const width of WIDTHS) rows.push(await markersAt(width, { minWidth: 1024 }));
    console.log(`\n<CategoryMegaMenu/> minWidth={1024}\n${table(rows)}`);

    const at = (width: number): GuardMarkers => {
      const row = rows.find((candidate) => candidate.width === width);
      if (row === undefined) throw new Error(`no row at ${String(width)}`);
      return row;
    };
    for (const width of [767, 768, 1023]) {
      expect(at(width).panel, `panel at ${String(width)}`).toBe(false);
      expect(at(width).treeRead, `tree read at ${String(width)}`).toBe(false);
    }
    for (const width of [1024, 1199, 1200]) {
      expect(at(width).panel, `panel at ${String(width)}`).toBe(true);
      expect(at(width).treeRead, `tree read at ${String(width)}`).toBe(true);
    }
  });
});
