/**
 * `<TileMap/>` — the basemap this package draws itself.
 *
 * The tile grid is sized from the ELEMENT, so jsdom (which computes no layout)
 * measures 0x0 until `resizeTo` hands the drivable `ResizeObserver` a box —
 * which is the point of that stub, and of this file: without it "the grid is
 * measured from the element and not the viewport" would be a claim in a
 * comment rather than something a test can fail on.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { TileMap, clampToBbox } from "../src/default/TileMap.js";
import type { TileLayer } from "../src/api/types.js";
import type { LatLon } from "../src/model/coords.js";
import { resizeTo } from "./resizeDriver.js";

const LAYER: TileLayer = {
  url_template: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  subdomains: [],
  attribution_html:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  attribution_text: "© OpenStreetMap contributors",
  policy_url: "https://operations.osmfoundation.org/policies/tiles/",
  requires_attribution: true,
  min_zoom: 2,
  max_zoom: 19,
};

const LABELS = {
  map: "Map control",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  pin: "Chosen point",
};

const BERLIN: LatLon = { lat: 52.51667, lon: 13.38333 };

function mount(
  overrides?: Partial<{ zoom: number; bbox: readonly number[] | null }>
): { onChange: ReturnType<typeof vi.fn> } {
  const onChange = vi.fn();
  render(
    <TileMap
      layer={LAYER}
      center={BERLIN}
      zoom={overrides?.zoom ?? 13}
      bbox={overrides?.bbox ?? null}
      labels={LABELS}
      onChange={onChange}
      data-testid="map"
    />
  );
  return { onChange };
}

describe("<TileMap/> tiles", () => {
  it("draws no tiles until the ELEMENT has a box, then fills it", () => {
    mount();
    expect(document.querySelectorAll("img")).toHaveLength(0);
    act(() => {
      resizeTo(512, 384);
    });
    const images = [...document.querySelectorAll("img")];
    expect(images.length).toBeGreaterThanOrEqual(6);
    for (const image of images) {
      expect(image.getAttribute("src")).toMatch(
        /^https:\/\/tile\.openstreetmap\.org\/13\/\d+\/\d+\.png$/
      );
      // Decorative: the map's accessible name is on the container.
      expect(image.getAttribute("alt")).toBe("");
    }
  });

  it("re-tiles when the element's box changes, not when the window does", () => {
    mount();
    act(() => {
      resizeTo(300, 300);
    });
    const small = document.querySelectorAll("img").length;
    act(() => {
      resizeTo(1200, 800);
    });
    expect(document.querySelectorAll("img").length).toBeGreaterThan(small);
  });

  it("hides a tile that 404s rather than drawing a broken-image glyph", () => {
    mount();
    act(() => {
      resizeTo(512, 384);
    });
    const image = document.querySelector("img");
    expect(image).not.toBeNull();
    fireEvent.error(image as HTMLImageElement);
    expect((image as HTMLImageElement).style.visibility).toBe("hidden");
  });
});

describe("<TileMap/> camera", () => {
  it("pans on a pointer drag, opposite to the finger", () => {
    const { onChange } = mount();
    const map = screen.getByTestId("map");
    fireEvent.pointerDown(map, { clientX: 200, clientY: 200, isPrimary: true, pointerId: 1 });
    fireEvent.pointerMove(map, { clientX: 260, clientY: 200, pointerId: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
    const [center] = onChange.mock.calls[0] as [LatLon, number];
    expect(center.lon).toBeLessThan(BERLIN.lon);
    fireEvent.pointerUp(map, { pointerId: 1 });
  });

  it("zooms with the buttons and clamps to the layer's own range", () => {
    const { onChange } = mount({ zoom: 13 });
    fireEvent.click(screen.getByTestId("geo-zoom-in"));
    expect(onChange).toHaveBeenLastCalledWith(expect.anything(), 14);
    fireEvent.click(screen.getByTestId("geo-zoom-out"));
    expect(onChange).toHaveBeenLastCalledWith(expect.anything(), 12);
  });

  it("offers no zoom-in at the layer's max and no zoom-out at its min", () => {
    mount({ zoom: 19 });
    expect((screen.getByTestId("geo-zoom-in") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("geo-zoom-out") as HTMLButtonElement).disabled).toBe(false);
  });

  it("zooms on a double click", () => {
    const { onChange } = mount({ zoom: 10 });
    fireEvent.doubleClick(screen.getByTestId("map"));
    expect(onChange).toHaveBeenLastCalledWith(expect.anything(), 11);
  });

  it("zooms on the wheel", () => {
    const { onChange } = mount({ zoom: 10 });
    fireEvent.wheel(screen.getByTestId("map"), { deltaY: -120 });
    expect(onChange).toHaveBeenLastCalledWith(expect.anything(), 11);
  });
});

describe("<TileMap/> keyboard", () => {
  it("is focusable and carries an accessible name", () => {
    mount();
    const map = screen.getByRole("application", { name: LABELS.map });
    expect(map.getAttribute("tabindex")).toBe("0");
  });

  it("pans with the arrow keys — a pointer-only map is not usable", () => {
    const { onChange } = mount();
    const map = screen.getByTestId("map");
    fireEvent.keyDown(map, { key: "ArrowRight" });
    const [east] = onChange.mock.calls[0] as [LatLon, number];
    expect(east.lon).toBeGreaterThan(BERLIN.lon);
    fireEvent.keyDown(map, { key: "ArrowUp" });
    const [north] = onChange.mock.calls[1] as [LatLon, number];
    expect(north.lat).toBeGreaterThan(BERLIN.lat);
  });

  it("zooms with + and -", () => {
    const { onChange } = mount({ zoom: 10 });
    const map = screen.getByTestId("map");
    fireEvent.keyDown(map, { key: "+" });
    expect(onChange).toHaveBeenLastCalledWith(expect.anything(), 11);
    fireEvent.keyDown(map, { key: "-" });
    expect(onChange).toHaveBeenLastCalledWith(expect.anything(), 9);
  });

  it("names the centre pin for a screen reader", () => {
    mount();
    expect(screen.getByRole("img", { name: LABELS.pin })).toBeDefined();
  });
});

describe("<TileMap/> attribution is a licence obligation", () => {
  it("renders the credit line, with the licence link the contract ships", () => {
    mount();
    const credit = document.querySelector("[data-geo-attribution]");
    expect(credit).not.toBeNull();
    expect(credit?.textContent).toContain("OpenStreetMap");
    expect(credit?.querySelector("a")?.getAttribute("href")).toBe(
      "https://www.openstreetmap.org/copyright"
    );
  });

  it("exposes no prop that could remove it", () => {
    const source = readFileSync(resolve("src/default/TileMap.tsx"), "utf8");
    const propsBlock = /export interface TileMapProps \{([\s\S]*?)\n\}/.exec(source)?.[1];
    expect(propsBlock).toBeDefined();
    // The property NAMES, with the prose stripped — the doc comment is allowed
    // to say "attribution", the API is not allowed to offer it as a switch.
    const names = [...(propsBlock ?? "").matchAll(/^\s*(?:readonly\s+)?["']?([\w-]+)["']?\??:/gm)]
      .map((match) => match[1] ?? "");
    expect(names).toContain("layer");
    // No `hideAttribution`, no `attribution`, no `showCredit`…
    for (const name of names) {
      expect(name).not.toMatch(/attribution|credit|hide|suppress/i);
    }
    // …and `requires_attribution` is never read as an opt-out anywhere here.
    expect(source).not.toMatch(/requires_attribution\s*(\?|&&|===|!==)/);
  });
});

describe("bbox", () => {
  it("keeps the centre inside the deployment's operating area", () => {
    const bbox = [19.6, 41.2, 60.0, 81.9];
    const pulledIn = clampToBbox({ lat: 10, lon: 0 }, bbox);
    expect(pulledIn.lat).toBeCloseTo(41.2, 6);
    expect(pulledIn.lon).toBeCloseTo(19.6, 6);
    expect(clampToBbox({ lat: 90, lon: 200 }, bbox).lat).toBeCloseTo(81.9, 6);
  });

  it("constrains latitude only for a wrapping box — a country may straddle the date line", () => {
    const wrapping = [170, 41.2, -170, 81.9];
    const clamped = clampToBbox({ lat: 55, lon: 0 }, wrapping);
    expect(clamped.lat).toBeCloseTo(55, 6);
    // Clamping into a wrapping interval with min/max would have teleported
    // this to the other side of the planet.
    expect(clamped.lon).toBeCloseTo(0, 6);
  });

  it("is a no-op when the deployment declares none", () => {
    const free = clampToBbox({ lat: 52.5, lon: 13.4 }, null);
    expect(free.lat).toBeCloseTo(52.5, 6);
    expect(free.lon).toBeCloseTo(13.4, 6);
  });

  it("is respected by a pan", () => {
    const { onChange } = mount({ bbox: [13.0, 52.0, 14.0, 53.0] });
    const map = screen.getByTestId("map");
    fireEvent.pointerDown(map, { clientX: 0, clientY: 0, isPrimary: true, pointerId: 1 });
    fireEvent.pointerMove(map, { clientX: 5000, clientY: 0, pointerId: 1 });
    const [center] = onChange.mock.calls[0] as [LatLon, number];
    expect(center.lon).toBeGreaterThanOrEqual(13.0);
    expect(center.lon).toBeLessThanOrEqual(14.0);
  });
});
