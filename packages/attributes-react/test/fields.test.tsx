/**
 * `<FeatureFields/>` — the composition rules, the ones that decide whether a
 * refusal is useful or merely present.
 *
 * The load-bearing case is error ROUTING: a server verdict names the feature
 * by slug, and the refusal has to land on that control. In a banner it says
 * "something is wrong"; under the control it says "this box is wrong", and
 * only the second one can be acted on.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { featureErrorsBySlug, mirrorValidate } from "../src/index.js";
import { registerAttributesI18n } from "../src/i18n/keys.js";
import { FeatureFields, featureControlId } from "../src/default/FeatureFields.js";
import { HEADER_FEATURE, INT_FEATURE, STRING_FEATURE } from "./fixtures.js";

afterEach(() => cleanup());

function wrap(node: ReactElement): ReactElement {
  const i18n = createI18n({ locale: "en" });
  registerAttributesI18n(i18n);
  return <I18nProvider i18n={i18n}>{node}</I18nProvider>;
}

const FEATURES = [{ ...STRING_FEATURE, mandatory: true }, INT_FEATURE, HEADER_FEATURE];

describe("rows", () => {
  it("labels each control with the feature's name, via htmlFor", () => {
    render(wrap(<FeatureFields features={FEATURES} values={{}} onChange={() => {}} />));
    expect(screen.getByLabelText("title").id).toBe(featureControlId("title"));
    expect(screen.getByLabelText("year").id).toBe(featureControlId("year"));
  });

  it("marks a mandatory feature required, and only a mandatory one", () => {
    const { container } = render(
      wrap(<FeatureFields features={FEATURES} values={{}} onChange={() => {}} />)
    );
    const required = container.querySelectorAll(".ant-form-item-required");
    expect(required).toHaveLength(1);
  });

  it("gives a header no label and no required marker — a caption is not a question", () => {
    render(wrap(<FeatureFields features={[HEADER_FEATURE]} values={{}} onChange={() => {}} />));
    expect(screen.getByRole("heading", { name: "engine section" })).toBeDefined();
    expect(screen.queryByText("engine section:")).toBeNull();
  });

  it("reports a change as (slug, value) so the composer owns the draft", () => {
    const onChange = vi.fn();
    render(wrap(<FeatureFields features={FEATURES} values={{}} onChange={onChange} />));
    fireEvent.change(screen.getByLabelText("title"), { target: { value: "Golf" } });
    expect(onChange).toHaveBeenCalledWith("title", "Golf");
  });

  it("goes read-only while a submit is in flight", () => {
    render(
      wrap(<FeatureFields features={FEATURES} values={{}} onChange={() => {}} disabled />)
    );
    expect(screen.getByLabelText("title")).toHaveProperty("disabled", true);
  });
});

describe("a verdict lands on the control that caused it", () => {
  it("puts a mirrored refusal under its own field, in the person's language", () => {
    const batch = mirrorValidate(FEATURES, { year: { type: "int", value: 9999 } });
    render(
      wrap(
        <FeatureFields
          features={FEATURES}
          values={{ year: 9999 }}
          onChange={() => {}}
          errors={featureErrorsBySlug(batch)}
        />
      )
    );
    // Rendered from the ENGINE's own key, with the engine's own params.
    expect(screen.getByText("Value is above maximum for year")).toBeDefined();
    expect(screen.getByText("Mandatory feature title is required")).toBeDefined();
  });

  it("reads a SERVER verdict through the same one step", () => {
    const errors = featureErrorsBySlug({
      valid: false,
      results: [
        {
          slug: "year",
          status: "validation_failed",
          error: "not_in_options",
          localizable_error: "error.400.feature_not_in_options",
          params: { feature: "Year of manufacture", slug: "year" },
        },
      ],
    });
    render(
      wrap(
        <FeatureFields features={FEATURES} values={{}} onChange={() => {}} errors={errors} />
      )
    );
    expect(
      screen.getByText("Value is not in allowed options for Year of manufacture")
    ).toBeDefined();
  });

  it("marks only the refused row, not the whole form", () => {
    const errors = featureErrorsBySlug(mirrorValidate(FEATURES, { year: { type: "int", value: 9999 } }));
    const { container } = render(
      wrap(
        <FeatureFields
          features={[INT_FEATURE]}
          values={{ year: 9999 }}
          onChange={() => {}}
          errors={errors}
        />
      )
    );
    expect(container.querySelectorAll(".ant-form-item-has-error")).toHaveLength(1);
  });
});

describe("renderRow", () => {
  it("lets a host supply its own field chrome without losing the ladder", () => {
    render(
      wrap(
        <FeatureFields
          features={[STRING_FEATURE]}
          values={{}}
          onChange={() => {}}
          renderRow={(row) => (
            <label htmlFor={row.controlId} data-testid="host-row">
              {row.feature.slug}
              {row.control}
            </label>
          )}
        />
      )
    );
    expect(screen.getByTestId("host-row")).toBeDefined();
    expect(screen.getByLabelText("title")).toBeDefined();
  });
});
