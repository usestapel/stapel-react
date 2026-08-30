/**
 * The category → attributes-react bridge: the schema endpoint's payload, what
 * this pair decides about it, and what it deliberately leaves to the package
 * that owns value types.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  featureConfig,
  featureName,
  featureType,
  unsupportedTypes,
} from "@stapel/attributes-react";
import { BUILTIN_VALUE_EDITOR_TYPES } from "@stapel/attributes-react/default";
import { CategoryFeatures } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { FEATURES, FEATURE_POWER } from "./fixtures.js";

function Probe(props: { id: number | null }): ReactElement {
  return (
    <CategoryFeatures categoryId={props.id}>
      {(bag) => (
        <div>
          <span data-testid="status">{bag.state.status}</span>
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
          <span data-testid="badges">
            {bag.badges.map((f) => f.slug).join(",")}
          </span>
          <span data-testid="titles">
            {bag.titleParts.map((f) => f.slug).join(",")}
          </span>
          <span data-testid="unsupported">
            {unsupportedTypes(bag.features, BUILTIN_VALUE_EDITOR_TYPES).join(",")}
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
