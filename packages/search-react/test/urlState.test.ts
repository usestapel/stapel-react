import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  buildFacetKeyMap,
  facetKeyMapFromLabels,
  clearFilters,
  ownsParam,
  parseSearchState,
  patchSearchState,
  searchQueryParams,
  setFilterValues,
  setRangeValue,
  toggleFilterValue,
  writeSearchState,
} from "../src/index.js";
import { liveCarsResponse } from "./liveCars.js";

const OPTIONS = { defaultType: "listing" } as const;

function parse(search: string) {
  return parseSearchState(new URLSearchParams(search), OPTIONS);
}

describe("URL → state → URL, in both directions (spec §4.2)", () => {
  it("round-trips the full parameter set byte-for-byte", () => {
    const search =
      "type=listing&q=drill&lang=ru&category=tools%2Fpower&owner=u-7" +
      "&f.brand=bosch&f.brand=makita&f.condition=new" +
      "&r.price=100..500&r.year=..2020" +
      "&lat=55.75&lon=37.62&radius_km=25" +
      "&sort=price_asc&facets=brand%2Ccondition&anchor=abc&direction=next&limit=48";
    const { state, issues } = parse(search);
    expect(issues).toEqual([]);
    // Written back, then read again: the SAME state. Order inside the string
    // is the codec's business; the meaning is what must survive.
    const written = writeSearchState(state);
    expect(parseSearchState(written, OPTIONS).state).toEqual(state);
  });

  it("reads a repeated f.<slug> as OR within the slug", () => {
    const { state } = parse("type=listing&f.brand=bosch&f.brand=makita");
    expect(state.filters["brand"]).toEqual(["bosch", "makita"]);
    // …and writes it back as a repeated key, not a comma-joined one: the
    // backend reads `getlist`, and "bosch,makita" would be one literal value.
    expect(writeSearchState(state).getAll("f.brand")).toEqual(["bosch", "makita"]);
  });

  it("reads r.<slug> with either end omitted", () => {
    const { state } = parse("type=listing&r.price=100..500&r.year=..2020&r.km=5..");
    expect(state.ranges["price"]).toEqual({ from: "100", to: "500" });
    expect(state.ranges["year"]).toEqual({ to: "2020" });
    expect(state.ranges["km"]).toEqual({ from: "5" });
  });

  it("keeps an antimeridian bbox exactly as written", () => {
    // minLon > maxLon is LEGAL — the box crosses ±180. Normalizing it would
    // silently turn a Pacific search into the rest of the world.
    const { state, issues } = parse("type=listing&bbox=-40,170,-30,-170");
    expect(issues).toEqual([]);
    expect(state.geo).toEqual({
      kind: "bbox",
      minLat: -40,
      minLon: 170,
      maxLat: -30,
      maxLon: -170,
    });
    expect(writeSearchState(state).get("bbox")).toBe("-40,170,-30,-170");
  });

  it("bbox wins over lat/lon, as it does server-side", () => {
    const { state } = parse("type=listing&bbox=1,2,3,4&lat=55&lon=37");
    expect(state.geo?.kind).toBe("bbox");
  });

  it("preserves query parameters it does not own", () => {
    const base = new URLSearchParams("type=listing&utm_source=telegram&ref=42");
    const { state } = parseSearchState(base, OPTIONS);
    const written = writeSearchState(patchSearchState(state, { q: "drill" }), base);
    expect(written.get("utm_source")).toBe("telegram");
    expect(written.get("ref")).toBe("42");
    expect(written.get("q")).toBe("drill");
  });

  it("removes a cleared filter from the URL instead of leaving a stale key", () => {
    const base = new URLSearchParams("type=listing&f.brand=bosch");
    const { state } = parseSearchState(base, OPTIONS);
    const written = writeSearchState(setFilterValues(state, "brand", []), base);
    expect(written.has("f.brand")).toBe(false);
  });

  it("knows which parameters it owns", () => {
    expect(ownsParam("f.brand")).toBe(true);
    expect(ownsParam("r.price")).toBe(true);
    expect(ownsParam("radius_km")).toBe(true);
    expect(ownsParam("utm_source")).toBe(false);
  });
});

describe("what the URL could not say, said out loud", () => {
  it("reports lat without lon rather than silently widening the search", () => {
    const { state, issues } = parse("type=listing&lat=55.75");
    expect(state.geo).toBeUndefined();
    expect(issues).toEqual([
      {
        param: "lon",
        code: "geo_incomplete",
        messageKey: "search.url.issue.geo_incomplete",
      },
    ]);
  });

  it("reports a malformed bbox", () => {
    const { issues } = parse("type=listing&bbox=1,2,3");
    expect(issues[0]?.code).toBe("bbox_malformed");
  });

  it("reports a range that is not from..to", () => {
    const { state, issues } = parse("type=listing&r.price=cheap");
    expect(state.ranges["price"]).toBeUndefined();
    expect(issues[0]).toMatchObject({ param: "r.price", code: "range_malformed" });
  });

  it("reports a non-numeric limit", () => {
    const { state, issues } = parse("type=listing&limit=lots");
    expect(state.limit).toBeUndefined();
    expect(issues[0]?.code).toBe("not_a_number");
  });

  it("keeps an unknown sort so the SERVER names the refusal", () => {
    // The schema declares no enum for `sort`; a deployment may add one. A
    // client that reset it would rewrite a shared link's meaning on load.
    const { state, issues } = parse("type=listing&sort=cheapest_first");
    expect(state.sort).toBe("cheapest_first");
    expect(issues).toEqual([]);
  });
});

describe("the cursor is dropped by every change that is not a page move", () => {
  const paged = parse("type=listing&f.brand=bosch&anchor=abc&direction=next").state;

  it("drops it on a filter change", () => {
    const next = toggleFilterValue(paged, "brand", "makita");
    expect(next.anchor).toBeUndefined();
    expect(next.direction).toBeUndefined();
  });

  it("drops it on a sort change", () => {
    expect(patchSearchState(paged, { sort: "newest" }).anchor).toBeUndefined();
  });

  it("drops it on a range change and on clear-all", () => {
    expect(setRangeValue(paged, "price", { from: "100" }).anchor).toBeUndefined();
    expect(clearFilters(paged).anchor).toBeUndefined();
  });

  it("KEEPS it when the patch is the page move itself", () => {
    const next = patchSearchState(paged, { anchor: "def", direction: "next" });
    expect(next.anchor).toBe("def");
  });

  it("clears it when a page move passes a null anchor (back to page one)", () => {
    const next = patchSearchState(paged, { anchor: null, direction: "prev" });
    expect(next.anchor).toBeUndefined();
    expect(next.direction).toBe("prev");
  });
});

describe("clear-all keeps what identifies the search, drops what constrains it", () => {
  it("keeps type, text, language, category AND THE PLACE; drops filters and ranges", () => {
    const { state } = parse(
      "type=listing&q=drill&lang=ru&category=tools&f.brand=bosch&r.price=1..2&lat=55&lon=37"
    );
    const cleared = clearFilters(state);
    expect(cleared.type).toBe("listing");
    expect(cleared.q).toBe("drill");
    expect(cleared.lang).toBe("ru");
    // On /c/:slug the category IS the page, not a filter a person set.
    expect(cleared.category).toBe("tools");
    expect(cleared.filters).toEqual({});
    expect(cleared.ranges).toEqual({});
    // The PLACE survives, because it is not one of the things this control
    // counts and not one of the things it names. A person widening a price
    // range did not ask to be moved back to the whole country; the location
    // control has its own way off and it says which place it would remove.
    expect(cleared.geo).toEqual({ kind: "center", lat: 55, lon: 37 });
  });

  it("counts the constraints a person actually applied — AND A LATITUDE IS NOT ONE", () => {
    const { state } = parse(
      "type=listing&f.brand=bosch&f.brand=makita&r.price=1..2&lat=55&lon=37"
    );
    // Three: two brands and a price range. The point used to add a fourth,
    // which is how a live landing came to say "clear all filters (2)" over an
    // empty page with two constraints that had no chip, no name and no row.
    expect(activeFilterCount(state)).toBe(3);
    expect(activeFilterCount(parse("type=listing&lat=55&lon=37").state)).toBe(0);
  });
});

describe("a value equal to its default is omitted from the address (D343)", () => {
  const DEFAULTS = { defaultType: "listing", defaultSort: "relevance", defaultLimit: 24 };

  it("omits type, sort and limit when they equal the default", () => {
    const { state } = parse("type=listing&sort=relevance&limit=24");
    const written = writeSearchState(state, undefined, undefined, DEFAULTS);
    expect(written.has("type")).toBe(false);
    expect(written.has("sort")).toBe(false);
    expect(written.has("limit")).toBe(false);
  });

  it("still writes them when they differ from the default", () => {
    const { state } = parse("type=car&sort=price_asc&limit=48");
    const written = writeSearchState(state, undefined, undefined, DEFAULTS);
    expect(written.get("type")).toBe("car");
    expect(written.get("sort")).toBe("price_asc");
    expect(written.get("limit")).toBe("48");
  });

  it("still reads the default back when the address omits the parameter", () => {
    const { state, issues } = parseSearchState(new URLSearchParams(""), DEFAULTS);
    expect(issues).toEqual([]);
    expect(state.type).toBe("listing");
    expect(state.sort).toBe("relevance");
    expect(state.limit).toBe(24);
  });

  it("without defaults, writes every one of the three exactly as before", () => {
    // Backward compatible: a caller that never passes `defaults` sees no
    // change in behaviour.
    const { state } = parse("type=listing&sort=relevance&limit=24");
    const written = writeSearchState(state);
    expect(written.get("type")).toBe("listing");
    expect(written.get("sort")).toBe("relevance");
    expect(written.get("limit")).toBe("24");
  });
});

describe("state → wire query", () => {
  it("emits the backend's own parameter names and shapes", () => {
    const { state } = parse(
      "type=listing&q=drill&f.brand=bosch&f.brand=makita&r.price=100..500&lat=55.75&lon=37.62&radius_km=25&sort=distance&facets=brand%2Ccondition&limit=48"
    );
    expect(searchQueryParams(state)).toEqual({
      type: "listing",
      q: "drill",
      "f.brand": ["bosch", "makita"],
      "r.price": "100..500",
      lat: 55.75,
      lon: 37.62,
      radius_km: 25,
      sort: "distance",
      facets: "brand,condition",
      limit: 48,
    });
  });

  it("omits an empty text and an empty filter list entirely", () => {
    const { state } = parse("type=listing");
    expect(searchQueryParams(setFilterValues(state, "brand", []))).toEqual({
      type: "listing",
    });
  });
});

/**
 * SHORT FEATURE KEYS — `f.make`, not `f.make_ref_select`.
 *
 * The map is the ANSWER's (`facet_labels[slug].url_key`, derived by the
 * server inside the queried category's scope); this codec never chops a
 * suffix off a slug of its own accord. Both forms READ, one form WRITES, and
 * anything ambiguous keeps the slug on both sides.
 */
describe("short feature keys in the address", () => {
  // The live cars leaf, 2026-09-04: `make_ref_select` is addressed as `make`,
  // `model` has no suffix to drop and stays itself.
  const CARS = buildFacetKeyMap({
    make_ref_select: "make",
    model: "model",
    year: "year",
  });

  it("WRITES the url_key the answer states", () => {
    const { state } = parse("type=listing");
    const written = writeSearchState(
      setRangeValue(setFilterValues(state, "make_ref_select", ["toyota"]), "year", {
        from: "2015",
        to: "2020",
      }),
      undefined,
      CARS
    );
    expect(written.getAll("f.make")).toEqual(["toyota"]);
    expect(written.get("r.year")).toBe("2015..2020");
    expect(written.get("f.make_ref_select")).toBeNull();
  });

  it("READS the short form back onto the slug", () => {
    const { state } = parseSearchState(
      new URLSearchParams("type=listing&f.make=toyota&r.year=2015.."),
      { ...OPTIONS, facetKeys: CARS }
    );
    expect(state.filters).toEqual({ make_ref_select: ["toyota"] });
    expect(state.ranges).toEqual({ year: { from: "2015" } });
  });

  it("READS the full slug too — an old link keeps working", () => {
    const { state } = parseSearchState(
      new URLSearchParams("type=listing&f.make_ref_select=toyota"),
      { ...OPTIONS, facetKeys: CARS }
    );
    expect(state.filters).toEqual({ make_ref_select: ["toyota"] });
  });

  it("writes the SLUG when the answer states no url_key for it", () => {
    // A pre-0.14.4 server, a text query, a branch node: no scope, no short
    // form, and the address is exactly what it always was.
    const { state } = parse("type=listing");
    const written = writeSearchState(
      setFilterValues(state, "make_ref_select", ["toyota"]),
      undefined,
      buildFacetKeyMap({ make_ref_select: null })
    );
    expect(written.getAll("f.make_ref_select")).toEqual(["toyota"]);
  });

  it("a COLLISION keeps the slug on both sides", () => {
    // Two slugs shortening to one key, and a short form that IS another
    // slug of the same scope. Neither may take it: the reader would get one
    // filter back for another. (The server applies the same rule; this is
    // the client refusing to trust that it did.)
    const keys = buildFacetKeyMap({
      make_ref_select: "make",
      make_select: "make",
      color_ref_select: "color",
      color: "color",
    });
    expect(keys.write).toEqual({});
    expect(keys.read["make"]).toBeUndefined();
    // A real slug always resolves to itself.
    expect(keys.read["color"]).toBe("color");
    const { state } = parse("type=listing");
    expect(
      writeSearchState(
        setFilterValues(state, "make_ref_select", ["toyota"]),
        undefined,
        keys
      ).getAll("f.make_ref_select")
    ).toEqual(["toyota"]);
  });

  it("reads an unknown key unchanged instead of dropping the filter", () => {
    const { state } = parseSearchState(
      new URLSearchParams("type=listing&f.mystery=x"),
      { ...OPTIONS, facetKeys: CARS }
    );
    expect(state.filters).toEqual({ mystery: ["x"] });
  });

  it("takes the map straight off an answer's facet_labels", () => {
    const keys = facetKeyMapFromLabels(liveCarsResponse().facet_labels);
    expect(keys.write["make_ref_select"]).toBe("make");
    expect(keys.write["fuel_type_ref_select"]).toBe("fuel_type");
    // A slug with no suffix to drop writes itself.
    expect(keys.write["model"]).toBeUndefined();
    expect(keys.read["make"]).toBe("make_ref_select");
    expect(keys.read["model"]).toBe("model");
  });
});
