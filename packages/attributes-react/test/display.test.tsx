/**
 * `<FeatureBadges/>` and `<FeatureValueList/>` — and the rule a naive spec
 * table breaks: an unreadable value SAYS SO. An empty cell where a spec line
 * belongs reads as "this listing has no engine size", which is a different
 * and false statement.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import type { FeaturesDto } from "../src/types.js";
import { registerAttributesI18n } from "../src/i18n/keys.js";
import { FeatureBadges, FeatureValueList } from "../src/default/FeatureBadges.js";
import {
  BOOL_FEATURE,
  FLOAT_FEATURE,
  HEADER_FEATURE,
  HEX_COLOR_FEATURE,
  INT_FEATURE,
  STRING_FEATURE,
  UNKNOWN_TYPE_FEATURE,
} from "./fixtures.js";

afterEach(() => cleanup());

function wrap(node: ReactElement): ReactElement {
  const i18n = createI18n({ locale: "en" });
  registerAttributesI18n(i18n);
  return <I18nProvider i18n={i18n}>{node}</I18nProvider>;
}

const VALUES: FeaturesDto = {
  title: { type: "string", value: "Golf" },
  year: { type: "int", value: 2010 },
  negotiable: { type: "bool", value: true },
  colour: { type: "hex_color", value: { simple: "red", hex: "#FF0000" } },
  size_grid: { type: "size_grid", value: { rowIndex: 2 } },
};

describe("<FeatureBadges/> — the category's own choice of what to show", () => {
  it("renders only the features flagged show_as_badge", () => {
    render(
      wrap(
        <FeatureBadges
          features={[
            STRING_FEATURE,
            { ...INT_FEATURE, show_as_badge: true },
            { ...BOOL_FEATURE, show_as_badge: true },
          ]}
          values={VALUES}
        />
      )
    );
    expect(screen.getByTestId("attributes-badge-year").textContent).toBe("2010");
    expect(screen.getByTestId("attributes-badge-negotiable").textContent).toBe("Negotiable");
    expect(screen.queryByTestId("attributes-badge-title")).toBeNull();
  });

  it("omits a badge with no value — a card is a summary, and 'not specified' is not one", () => {
    render(
      wrap(<FeatureBadges features={[{ ...INT_FEATURE, show_as_badge: true }]} values={{}} />)
    );
    expect(screen.queryByTestId("attributes-badge-year")).toBeNull();
  });

  it("paints a hex_color badge with the colour the value carries", () => {
    render(
      wrap(
        <FeatureBadges features={[{ ...HEX_COLOR_FEATURE, show_as_badge: true }]} values={VALUES} />
      )
    );
    expect(screen.getByTestId("attributes-badge-colour")).toBeDefined();
  });
});

describe("<FeatureValueList/> — the spec table", () => {
  it("lists every non-header feature with its value", () => {
    render(
      wrap(<FeatureValueList features={[STRING_FEATURE, INT_FEATURE, HEADER_FEATURE]} values={VALUES} />)
    );
    expect(screen.getByText("Golf")).toBeDefined();
    expect(screen.getByText("2010")).toBeDefined();
    expect(screen.queryByText("engine section")).toBeNull();
  });

  it("says 'not specified' rather than leaving a cell blank", () => {
    render(wrap(<FeatureValueList features={[INT_FEATURE]} values={{}} />));
    expect(screen.getByText("Not specified")).toBeDefined();
  });

  it("NAMES a value it cannot read, instead of showing an empty cell", () => {
    render(wrap(<FeatureValueList features={[UNKNOWN_TYPE_FEATURE]} values={VALUES} />));
    const cell = screen.getByTestId("attributes-unreadable-value");
    expect(cell.textContent).toContain("size_grid");
  });

  it("keeps the two absences distinguishable", () => {
    render(
      // `engine` was never filled in; `size_grid` was, in a type this build
      // cannot read. Two different sentences, one table.
      wrap(<FeatureValueList features={[FLOAT_FEATURE, UNKNOWN_TYPE_FEATURE]} values={VALUES} />)
    );
    expect(screen.getByText("Not specified")).toBeDefined();
    expect(screen.getByTestId("attributes-unreadable-value")).toBeDefined();
  });
});
