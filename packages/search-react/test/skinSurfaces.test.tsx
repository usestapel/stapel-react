/**
 * Every `/default` SURFACE, in both viewports and both themes.
 *
 * The matrix is the point. Three of this pair's shipped defects were invisible
 * to a suite that rendered one shape in one theme:
 *
 *  - a `mode = "light"` literal reads perfectly in a light suite and paints a
 *    near-white error alert on a dark deployment (the substrate deleted the
 *    literal; this is what keeps it deleted);
 *  - the filter panel was a column on a phone until it became a sheet, and the
 *    test env answered `matches: false` to every media query, so the desktop
 *    layout was never actually exercised — every suite rendered the phone one;
 *  - a surface that renders at all in one theme can still throw in the other,
 *    because the theme is what decides which antd tokens are computed.
 *
 * So each surface is mounted four ways and asserted to (a) render its own body
 * and (b) carry the mode the DOCUMENT declares — never a hardcoded side.
 */
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  FacetPanelPane,
  RankingDisclosurePane,
  SearchPage,
  SearchResultsPane,
} from "../src/default/index.js";
import type { SearchParamsAdapter } from "../src/index.js";
import { FEATURES, RANKING, searchResponse } from "./fixtures.js";
import {
  DESKTOP_WIDTH,
  PHONE_WIDTH,
  TestHarness,
  TestProviders,
  mockServer,
  resetTheme,
  setDocumentTheme,
  setViewport,
  useTestParams,
} from "./harness.js";

type ThemeMode = "light" | "dark";

function server(): ReturnType<typeof mockServer> {
  return mockServer({
    "/query": { body: searchResponse() },
    "/ranking": { body: RANKING },
    "/suggest": { body: { items: [], backend: "postgres" } },
  });
}

function Page(): ReactElement {
  const adapter: SearchParamsAdapter = useTestParams("type=listing&q=bosch");
  return <SearchPage adapter={adapter} defaultType="listing" categoryFeatures={FEATURES} />;
}

/**
 * The surfaces under test: what mounts them, and the body each one must draw.
 * `SearchPage` brings its own state provider (it takes the adapter); the panes
 * are mounted inside the shared `TestHarness` one.
 */
const SURFACES: readonly {
  readonly name: string;
  readonly body: string;
  readonly render: () => ReactElement;
}[] = [
  {
    name: "SearchPage",
    body: "search-page",
    render: () => (
      <TestProviders server={server()}>
        <Page />
      </TestProviders>
    ),
  },
  {
    name: "SearchResultsPane",
    body: "search-results",
    render: () => (
      <TestHarness server={server()} initialSearch="type=listing&q=bosch">
        <SearchResultsPane />
      </TestHarness>
    ),
  },
  {
    name: "FacetPanelPane",
    body: "search-facets",
    render: () => (
      <TestHarness server={server()} initialSearch="type=listing&q=bosch">
        <FacetPanelPane categoryFeatures={FEATURES} />
      </TestHarness>
    ),
  },
  {
    name: "RankingDisclosurePane",
    body: "search-ranking",
    render: () => (
      <TestHarness server={server()}>
        <RankingDisclosurePane />
      </TestHarness>
    ),
  },
];

const VIEWPORTS: readonly { readonly name: string; readonly width: number }[] = [
  { name: "phone", width: PHONE_WIDTH },
  { name: "desktop", width: DESKTOP_WIDTH },
];

const MODES: readonly ThemeMode[] = ["light", "dark"];

afterEach(() => {
  resetTheme();
  setViewport(DESKTOP_WIDTH);
});

describe("every default-skin surface renders in both viewports and both themes", () => {
  for (const surface of SURFACES) {
    for (const viewport of VIEWPORTS) {
      for (const mode of MODES) {
        it(`${surface.name} — ${viewport.name}, ${mode}`, async () => {
          // Both BEFORE the render: the substrate reads the viewport and the
          // document's theme on its first frame, and a surface that only gets
          // them right after an effect has already painted the wrong one.
          setViewport(viewport.width);
          setDocumentTheme(mode);

          const { container } = render(surface.render());

          await waitFor(() => {
            expect(screen.getByTestId(surface.body)).toBeTruthy();
          });

          // The mode is the DOCUMENT's, not a default baked into the skin.
          const roots = container.querySelectorAll("[data-stapel-skin-mode]");
          expect(roots.length).toBeGreaterThan(0);
          for (const root of roots) {
            expect(root.getAttribute("data-stapel-skin-mode")).toBe(mode);
          }
        });
      }
    }
  }
});

describe("the filter surface follows the viewport, not a constant", () => {
  it("puts the filters behind a sheet control on a phone", async () => {
    setViewport(PHONE_WIDTH);
    render(
      <TestProviders server={server()}>
        <Page />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-page").getAttribute("data-filters-layout")).toBe(
        "sheet"
      );
    });
    // The panel itself is NOT laid out beside the results — that is the whole
    // difference between a phone layout and a narrow desktop one.
    expect(screen.queryByTestId("search-facets")).toBeNull();
  });

  it("lays the filter column out beside the results on a desktop", async () => {
    setViewport(DESKTOP_WIDTH);
    render(
      <TestProviders server={server()}>
        <Page />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-facets")).toBeTruthy();
    });
    expect(screen.getByTestId("search-page").getAttribute("data-filters-layout")).toBe(
      "column"
    );
  });
});
