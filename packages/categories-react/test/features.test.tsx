/**
 * The category → attributes-react bridge: the schema endpoint's payload, what
 * this pair decides about it, and what it deliberately leaves to the package
 * that owns value types.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  AXIS_ROLES,
  byAxisRole,
  featureConfig,
  featureName,
  featureType,
  unsupportedTypes,
} from "@stapel/attributes-react";
import { BUILTIN_VALUE_EDITOR_TYPES } from "@stapel/attributes-react/default";
import { CategoryFeatures, visibleFeatures } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import {
  FEATURES,
  FEATURES_EFFECTIVE,
  FEATURE_BRAND,
  FEATURE_POWER,
} from "./fixtures.js";

function Probe(props: { id: number | null }): ReactElement {
  return (
    <CategoryFeatures categoryId={props.id}>
      {(bag) => (
        <div>
          <span data-testid="status">{bag.state.status}</span>
          <span data-testid="effective-from">{bag.effectiveFrom}</span>
          <span data-testid="slugs">
            {bag.state.status === "ready"
              ? bag.state.data.map((e) => e.feature.slug).join(",")
              : ""}
          </span>
          <span data-testid="types">
            {bag.state.status === "ready"
              ? bag.state.data.map((e) => e.type ?? "untyped").join(",")
              : ""}
          </span>
          <span data-testid="divergent">
            {bag.state.status === "ready"
              ? bag.state.data
                  .filter((e) => e.divergent)
                  .map((e) => e.feature.slug)
                  .join(",")
              : ""}
          </span>
          <span data-testid="badges">
            {bag.badges.map((f) => f.slug).join(",")}
          </span>
          <span data-testid="titles">
            {bag.titleParts.map((f) => f.slug).join(",")}
          </span>
          <span data-testid="unsupported">
            {unsupportedTypes(bag.features, BUILTIN_VALUE_EDITOR_TYPES).join(",")}
          </span>
          <span data-testid="axis-roles">
            {bag.state.status === "ready"
              ? bag.state.data
                  .map((e) => `${e.feature.slug}:${e.axisRole ?? "-"}`)
                  .join(",")
              : ""}
          </span>
          <span data-testid="axes">
            {AXIS_ROLES.map((role) => `${role}=${bag.axes[role]?.slug ?? "-"}`).join(
              ","
            )}
          </span>
        </div>
      )}
    </CategoryFeatures>
  );
}

describe("<CategoryFeatures>", () => {
  it("ready: the resolved schema, in server order", async () => {
    const server = mockServer({ "/features/": { body: FEATURES } });
    render(
      <TestProviders server={server}>
        <Probe id={2} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    expect(screen.getByTestId("slugs").textContent).toBe(
      "brand,power_w,warranty,closed_set,holo_signature"
    );
  });

  it("ready-empty: a category that asks for no extra details", async () => {
    const server = mockServer({ "/features/": { body: [] } });
    render(
      <TestProviders server={server}>
        <Probe id={9} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    expect(screen.getByTestId("slugs").textContent).toBe("");
  });

  it("failed: a refusal, with the real envelope", async () => {
    const server = mockServer({
      "/features/": {
        status: 404,
        body: { code: "stapel.http.404", message: "no such category" },
      },
    });
    render(
      <TestProviders server={server}>
        <Probe id={999} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("failed");
    });
  });

  it("does not ask at all without a category id", () => {
    const server = mockServer({ "/features/": { body: FEATURES } });
    render(
      <TestProviders server={server}>
        <Probe id={null} />
      </TestProviders>
    );
    expect(server.calls).toHaveLength(0);
    expect(screen.getByTestId("status").textContent).toBe("loading");
  });

  it("reads config.type through attributes-react's ONE reader", async () => {
    const server = mockServer({ "/features/": { body: FEATURES } });
    render(
      <TestProviders server={server}>
        <Probe id={2} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("types").textContent).toBe(
        "select,int,bool,select,holo_signature"
      );
    });
  });

  it("hands attributes-react a payload its own gate understands", async () => {
    // The integration in one assertion: the rows this pair fetches feed
    // `unsupportedTypes` unmodified, and it names the one type no builtin
    // editor covers. A pair that reshaped the payload would break this.
    const server = mockServer({ "/features/": { body: FEATURES } });
    render(
      <TestProviders server={server}>
        <Probe id={2} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("unsupported").textContent).toBe(
        "holo_signature"
      );
    });
  });

  it("splits the badge and title projections the server marks", async () => {
    const server = mockServer({ "/features/": { body: FEATURES } });
    render(
      <TestProviders server={server}>
        <Probe id={2} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("badges").textContent).toBe("brand");
    });
    expect(screen.getByTestId("titles").textContent).toBe("brand");
  });
});

describe("config arrives VERBATIM — defaults are attributes-react's job", () => {
  it("an absent config key is absent, not defaulted here", () => {
    // `FeatureCompactSerializer.get_config` returns `obj.config`, NOT
    // `get_config_with_defaults()` (attributes-react §13.2 note 1). A pair
    // that filled in `allowCustom` here would be inventing a second, drifting
    // copy of the type registry's defaults.
    const int = FEATURE_POWER;
    expect(featureType(int)).toBe("int");
    expect(featureConfig(int)["allowCustom"]).toBeUndefined();
    expect(featureConfig(int)["precision"]).toBeUndefined();
  });

  it("a name still falls back to the slug the way the server does", () => {
    expect(featureName({ slug: "bare", config: {} })).toBe("bare");
  });
});

describe("effectiveFrom — the X-Effective-From header (stapel-categories 0.20.1)", () => {
  it("reads 'own' off an ordinary answer", async () => {
    const server = mockServer({
      "/features/": { body: FEATURES, headers: { "X-Effective-From": "own" } },
    });
    render(
      <TestProviders server={server}>
        <Probe id={2} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    expect(screen.getByTestId("effective-from").textContent).toBe("own");
    expect(screen.getByTestId("divergent").textContent).toBe("");
  });

  it("reads 'children' off a chips parent's intersected answer, and surfaces divergent rows", async () => {
    const server = mockServer({
      "/features/": {
        body: FEATURES_EFFECTIVE,
        headers: { "X-Effective-From": "children" },
      },
    });
    render(
      <TestProviders server={server}>
        <Probe id={3} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    expect(screen.getByTestId("effective-from").textContent).toBe("children");
    expect(screen.getByTestId("divergent").textContent).toBe("screen_size");
  });

  it("defaults to 'own' when the server sends no header at all", async () => {
    // No `headers` on the route at all — a build older than 0.20.1.
    const server = mockServer({ "/features/": { body: FEATURES } });
    render(
      <TestProviders server={server}>
        <Probe id={2} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    expect(screen.getByTestId("effective-from").textContent).toBe("own");
  });

  it("defaults to 'own' before the read has answered", () => {
    const server = mockServer({ "/features/": { body: FEATURES } });
    render(
      <TestProviders server={server}>
        <Probe id={2} />
      </TestProviders>
    );
    expect(screen.getByTestId("effective-from").textContent).toBe("own");
  });
});

describe("visibleFeatures — hides a divergent row until a chip is picked", () => {
  it("hides divergent rows when no chip is picked", () => {
    const visible = visibleFeatures(FEATURES_EFFECTIVE, { chipPicked: false });
    expect(visible.map((f) => f.slug)).toEqual(["power_w"]);
  });

  it("shows every row once a chip is picked", () => {
    const visible = visibleFeatures(FEATURES_EFFECTIVE, { chipPicked: true });
    expect(visible.map((f) => f.slug)).toEqual(["power_w", "screen_size"]);
  });

  it("is a no-op over an 'own' schema, which never carries divergent rows", () => {
    expect(visibleFeatures(FEATURES, { chipPicked: false })).toEqual(FEATURES);
  });
});

/**
 * The axis role, end to end on this side of the seam — stapel-categories
 * 0.21.0 serves it, stapel-attributes 0.9.2 defines it, and the ONLY thing
 * this pair does with it is hand it on unchanged.
 *
 * Worth its own block because the failure it guards is invisible: a payload
 * key this pair never names is a key it can drop by accident (a mapped entry
 * built field by field, a fixture pruned, a serializer narrowed) and nothing
 * would fail — the storefront would simply go back to guessing the make from
 * a slug, which is the exact defect the field was added to end.
 */
describe("axis_role — which feature IS the make (stapel-categories 0.21.0)", () => {
  it("travels to a host on the RAW feature row, untouched", async () => {
    const server = mockServer({ "/features/": { body: FEATURES } });
    render(
      <TestProviders server={server}>
        <Probe id={2} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    // `bag.features` is the payload attributes-react draws from; the key is
    // on the row itself, not only on this pair's decorated entry.
    expect(FEATURE_BRAND["axis_role"]).toBe("make");
    expect(screen.getByTestId("axis-roles").textContent).toBe(
      "brand:make,power_w:-,warranty:-,closed_set:-,holo_signature:-"
    );
  });

  it("decides `axisRole` per entry through attributes-react's own reader", async () => {
    const server = mockServer({
      "/features/": {
        // A role nothing in the closed vocabulary covers. It must reach a
        // renderer as "no axis", never as a role a link could be built off.
        body: [{ ...FEATURE_BRAND, axis_role: "manufacturer" }],
      },
    });
    render(
      <TestProviders server={server}>
        <Probe id={2} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    expect(screen.getByTestId("axis-roles").textContent).toBe("brand:-");
    expect(screen.getByTestId("axes").textContent).toBe(
      "make=-,model=-,generation=-,year=-,mileage=-"
    );
  });

  it("`axes` is the lookup a storefront links off", async () => {
    const server = mockServer({ "/features/": { body: FEATURES } });
    render(
      <TestProviders server={server}>
        <Probe id={2} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("axes").textContent).toBe(
        "make=brand,model=-,generation=-,year=-,mileage=-"
      );
    });
  });

  it("a schema naming no axis answers an empty lookup, not a guess", async () => {
    // `brand` is gone; `power_w` and friends claim nothing. A reader that fell
    // back to slug-matching would still find a "brand"-ish field in a real
    // catalogue — this one must find nothing.
    const server = mockServer({
      "/features/": { body: FEATURES.filter((f) => f.slug !== "brand") },
    });
    render(
      <TestProviders server={server}>
        <Probe id={2} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    expect(screen.getByTestId("axes").textContent).toBe(
      "make=-,model=-,generation=-,year=-,mileage=-"
    );
  });

  it("drops a role two features claim — the same rule, one call away", async () => {
    // The pair does not re-implement the ambiguity rule; it calls the one that
    // owns it. This asserts the bag inherits that behaviour rather than that
    // this file re-derived it.
    const rows = [
      FEATURE_BRAND,
      { ...FEATURE_POWER, slug: "vendor", axis_role: "make" },
    ];
    const server = mockServer({ "/features/": { body: rows } });
    render(
      <TestProviders server={server}>
        <Probe id={2} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    expect(screen.getByTestId("axes").textContent).toBe(
      "make=-,model=-,generation=-,year=-,mileage=-"
    );
    expect(byAxisRole(rows).make).toBeUndefined();
    // The rows themselves still arrive — an unusable ROLE is not a dropped
    // feature, and both are still drawn, validated and faceted.
    expect(screen.getByTestId("slugs").textContent).toBe("brand,vendor");
  });
});
