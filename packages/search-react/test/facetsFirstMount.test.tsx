/**
 * p41 — CLS 0.0586 ON A PLAIN COLD LOAD OF `/c/transport-avtomobili`, AND IT
 * IS THE RAIL BEING DRAWN TWICE.
 *
 * The partition press is the one p43 closed, and it reads 0.005 now. This is
 * the other window, and nothing p43 shipped reaches it: `FacetPanelBag.
 * refreshing` is never true on a first load, so the floor each group stands on
 * while an answer is in flight does not exist in the one pass a cold load is
 * made of. The stand read `facet-group-make` moving 152px and
 * `facet-group-model` 76px, with `search-results` among the sources.
 *
 * What moves them is not a late ANSWER — it is a late SCHEMA. On a category
 * page the feature list is a separate read from the search (a different
 * service, a different arrival time), and the panel draws the rail the moment
 * the answer lands, with whatever schema it has, which on a cold load is none.
 * Both halves of what a group LOOKS like are functions of that schema:
 *
 *  - `facetGroupShape` reads `ref_select` and `maxSelected` off the feature, so
 *    with no schema the live cars answer draws make and model as three-row
 *    checkbox LISTS and condition and colour as checkboxes, and with it they
 *    are one-row dictionary FIELDS and segmented pills;
 *  - `orderFacetGroupsBySchema` puts the schema's required axes first, so the
 *    same groups also change places.
 *
 * Two shapes and two orders, one after the other, on every cold load. The fix
 * is that the panel is TOLD the schema is coming (`categoryFeaturesPending`)
 * and keeps the box it already reserves for a load in flight until it lands —
 * the rail is drawn once, in the shape and the order it keeps.
 *
 * jsdom lays nothing out, so this file asserts the CONTRACT rather than pixels:
 * which elements exist in which frame, and what box each group declares for
 * itself. Both are the things a browser then lays out.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  FACET_HEADING_HEIGHT,
  FACET_OPTION_ROW_HEIGHT,
  FacetPanelPane,
  SearchPage,
  facetGroupReservedHeight,
} from "../src/default/index.js";
import { mockServer, setViewport, DESKTOP_WIDTH, TestHarness } from "./harness.js";
import { LIVE_CARS_FEATURES, liveCarsResponse } from "./liveCars.js";

afterEach(cleanup);

const CARS = "type=listing&category=141/151/166";

/** Every group on the rail, as `slug → shape`. The reading the stand takes
 * with a screenshot; here it is the attribute the pane publishes. */
function shapes(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const node of document.querySelectorAll<HTMLElement>("[data-shape]")) {
    const id = node.dataset["testid"] ?? "?";
    out[id.replace("facet-group-", "")] = node.dataset["shape"] ?? "?";
  }
  return out;
}

/** The groups in the order the rail draws them. */
function order(): readonly string[] {
  return [...document.querySelectorAll<HTMLElement>("[data-shape]")].map((node) =>
    (node.dataset["testid"] ?? "").replace("facet-group-", "")
  );
}

function pane(props: { pending?: boolean; features?: boolean }): ReactElement {
  return (
    <FacetPanelPane
      categoryFilter={false}
      {...(props.features === true ? { categoryFeatures: LIVE_CARS_FEATURES } : {})}
      {...(props.pending === true ? { categoryFeaturesPending: true } : {})}
    />
  );
}

describe("the rail is drawn once, in the shape the schema gives it", () => {
  it("REPRODUCES the two rails: shapes and order both change when the schema lands", async () => {
    const server = mockServer({ query: { body: liveCarsResponse() } });
    const { rerender } = render(
      <TestHarness server={server} initialSearch={CARS}>
        {pane({})}
      </TestHarness>
    );
    await waitFor(() => screen.getByTestId("facet-group-model"));
    const before = { shapes: shapes(), order: order() };
    // The schema-less rail the answer alone produces: the two vocabulary axes
    // are checkbox lists, three rows each.
    expect(before.shapes["make_ref_select"]).toBe("checkbox");
    expect(before.shapes["model"]).toBe("checkbox");
    expect(before.shapes["accident"]).toBe("checkbox");

    rerender(
      <TestHarness server={server} initialSearch={CARS}>
        {pane({ features: true })}
      </TestHarness>
    );
    await waitFor(() => screen.getByTestId("facet-group-model"));
    const after = { shapes: shapes(), order: order() };
    // …and the same six axes, one frame later, are three other controls in
    // another order. Every one of those is a box changing height in place.
    expect(after.shapes["make_ref_select"]).toBe("dictionary");
    expect(after.shapes["model"]).toBe("dictionary");
    expect(after.shapes["accident"]).toBe("segmented");
    expect(after.order).not.toEqual(before.order);
  });

  it("holds the reserved box while the schema is PENDING — no groups, no second rail", async () => {
    const server = mockServer({ query: { body: liveCarsResponse() } });
    const { rerender } = render(
      <TestHarness server={server} initialSearch={CARS}>
        {pane({ pending: true })}
      </TestHarness>
    );
    // The answer has landed and the rail says why it is still a skeleton: the
    // groups in hand are provisional, and drawing them is what costs the shift.
    await waitFor(() => {
      expect(screen.getByTestId("search-facets").dataset["facetsSchema"]).toBe(
        "pending"
      );
    });
    expect(screen.queryByTestId("facet-group-model")).toBeNull();
    // The box is the one the pane already reserved for a load in flight, and it
    // is the SAME element before and after the schema lands.
    const reserve = screen.getByTestId("facets-loading");

    rerender(
      <TestHarness server={server} initialSearch={CARS}>
        {pane({ features: true })}
      </TestHarness>
    );
    const model = await screen.findByTestId("facet-group-model");
    expect(screen.getByTestId("search-facets").dataset["facetsSchema"]).toBe(
      "settled"
    );
    // One rail, and it is the schema's: the shape a group is drawn in never
    // changes under the reader, because it was never drawn in the other one.
    expect(model.dataset["shape"]).toBe("dictionary");
    expect(reserve.isConnected).toBe(false);
  });

  it("is unchanged for a surface that never had a schema to wait for", async () => {
    const server = mockServer({ query: { body: liveCarsResponse() } });
    render(
      <TestHarness server={server} initialSearch={CARS}>
        {pane({})}
      </TestHarness>
    );
    await waitFor(() => screen.getByTestId("facet-group-model"));
    expect(screen.getByTestId("search-facets").dataset["facetsSchema"]).toBe(
      "settled"
    );
  });
});

describe("a group's first-mount box is DECLARED, never nothing", () => {
  it("stands on the rows it draws, from the frame it mounts in", async () => {
    const server = mockServer({ query: { body: liveCarsResponse() } });
    render(
      <TestHarness server={server} initialSearch={CARS}>
        {pane({ features: true })}
      </TestHarness>
    );
    const model = await screen.findByTestId("facet-group-model");
    // A dictionary group's closed face is ONE field however many values the
    // vocabulary holds — which is exactly why a dependent axis drawn as one
    // does not resize when its options arrive with the next answer.
    expect(model.dataset["reservedSource"]).toBe("declared");
    expect(model.style.minBlockSize).toBe(
      `${String(
        facetGroupReservedHeight({
          shape: "dictionary",
          rows: 3,
          heading: true,
          open: true,
          folded: false,
        })
      )}px`
    );
    // Never zero, and never absent: a group with no box is the first-mount
    // hole p41 measured.
    expect(Number(model.dataset["reserved"])).toBeGreaterThan(0);
    for (const node of document.querySelectorAll<HTMLElement>("[data-shape]")) {
      expect(Number(node.dataset["reserved"] ?? "0")).toBeGreaterThan(0);
    }
  });

  it("declares a box per SHAPE, not one number for every group", () => {
    const heading = { heading: true, open: true, folded: false } as const;
    // A dictionary is a field; a checkbox group is one line per row; a
    // segmented group is a wrapping row of pills. Three controls, three boxes.
    expect(
      facetGroupReservedHeight({ shape: "dictionary", rows: 40, ...heading })
    ).toBeLessThan(
      facetGroupReservedHeight({ shape: "checkbox", rows: 8, ...heading })
    );
    expect(
      facetGroupReservedHeight({ shape: "checkbox", rows: 3, ...heading })
    ).toBe(FACET_HEADING_HEIGHT + 3 * FACET_OPTION_ROW_HEIGHT + 3 * 4);
    // A closed disclosure is its header and nothing else, and a group with no
    // heading and nothing open declares nothing at all rather than a floor of
    // zero written on every rail in the fleet.
    expect(
      facetGroupReservedHeight({
        shape: "checkbox",
        rows: 8,
        heading: true,
        open: false,
        folded: false,
      })
    ).toBe(FACET_HEADING_HEIGHT);
    expect(
      facetGroupReservedHeight({
        shape: "checkbox",
        rows: 8,
        heading: false,
        open: false,
        folded: false,
      })
    ).toBe(0);
  });
});

describe("the host's band above the rail is in flow from the first frame", () => {
  it("holds the declared height with nothing in it yet", async () => {
    setViewport(DESKTOP_WIDTH);
    const server = mockServer({ query: { body: liveCarsResponse() } });
    const { rerender } = render(
      <TestHarness server={server} initialSearch={CARS}>
        <SearchPage
          adapter={{ params: new URLSearchParams(CARS), setParams: () => undefined }}
          defaultType="listing"
          filtersHeaderReserve={96}
          categoryFilter={false}
          railFrom={0}
        />
      </TestHarness>
    );
    const band = await screen.findByTestId("search-filters-header");
    // The partition row is two chained catalogue reads behind the answer. Its
    // box is here before it is.
    expect(band.style.minBlockSize).toBe("96px");
    expect(band.textContent).toBe("");

    rerender(
      <TestHarness server={server} initialSearch={CARS}>
        <SearchPage
          adapter={{ params: new URLSearchParams(CARS), setParams: () => undefined }}
          defaultType="listing"
          filtersHeaderReserve={96}
          filtersHeader={<div data-testid="host-partition">partition</div>}
          categoryFilter={false}
          railFrom={0}
        />
      </TestHarness>
    );
    // The SAME element, now with the control inside it: the header landed into
    // its box rather than inserting one above the groups.
    expect(screen.getByTestId("search-filters-header")).toBe(band);
    expect(screen.getByTestId("host-partition")).toBeTruthy();
    expect(band.style.minBlockSize).toBe("96px");
  });

  it("reserves nothing where a host declared nothing", async () => {
    setViewport(DESKTOP_WIDTH);
    const server = mockServer({ query: { body: liveCarsResponse() } });
    render(
      <TestHarness server={server} initialSearch={CARS}>
        <SearchPage
          adapter={{ params: new URLSearchParams(CARS), setParams: () => undefined }}
          defaultType="listing"
          categoryFilter={false}
          railFrom={0}
        />
      </TestHarness>
    );
    await screen.findByTestId("search-facets");
    // A band held for a header nobody is sending is the same shift the other
    // way round.
    expect(screen.queryByTestId("search-filters-header")).toBeNull();
  });
});
