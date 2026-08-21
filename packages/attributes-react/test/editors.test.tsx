/**
 * One test per builtin value type: it renders, it labels its control, and a
 * change emits the shape the ENGINE's DTO wants — which is the half a
 * screenshot cannot check and the half that breaks a submit.
 *
 * Three of the ten emit something other than the bare scalar a reader would
 * assume, and each has its own case below: `select` is always a list, `date`
 * is a Unix timestamp, `hex_color` and `convertible_unit` are objects.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import type { FeatureDef } from "../src/types.js";
import { registerAttributesI18n } from "../src/i18n/keys.js";
import { FeatureFields, featureControlId } from "../src/default/FeatureFields.js";
import {
  inputValueToTimestamp,
  timestampToInputValue,
} from "../src/default/editors.js";
import {
  BOOL_FEATURE,
  CONVERTIBLE_FEATURE,
  DATE_FEATURE,
  FLOAT_FEATURE,
  HEADER_FEATURE,
  HEX_COLOR_FEATURE,
  HIERARCHICAL_FEATURE,
  INT_FEATURE,
  MULTI_SELECT_FEATURE,
  SELECT_FEATURE,
  STRING_FEATURE,
  feature,
} from "./fixtures.js";

afterEach(() => cleanup());

function renderOne(
  f: FeatureDef,
  value?: unknown
): { onChange: ReturnType<typeof vi.fn>; controlId: string } {
  const onChange = vi.fn();
  const i18n = createI18n({ locale: "en" });
  registerAttributesI18n(i18n);
  const node: ReactElement = (
    <I18nProvider i18n={i18n}>
      <FeatureFields
        features={[f]}
        values={value === undefined ? {} : { [f.slug]: value }}
        onChange={(slug, next) => onChange(slug, next)}
      />
    </I18nProvider>
  );
  render(node);
  return { onChange, controlId: featureControlId(f.slug) };
}

describe("string", () => {
  it("renders a labelled single-line input and emits the text", () => {
    const { onChange } = renderOne(STRING_FEATURE);
    const input = screen.getByLabelText("title");
    fireEvent.change(input, { target: { value: "Golf" } });
    expect(onChange).toHaveBeenCalledWith("title", "Golf");
  });

  it("renders a textarea when config.multiline is set", () => {
    renderOne(feature("body", { type: "string", multiline: true }));
    expect(screen.getByLabelText("body").tagName).toBe("TEXTAREA");
  });

  it("does NOT cap the control at maxLength — the DOM counts code units, the engine counts code points", () => {
    renderOne(STRING_FEATURE);
    expect(screen.getByLabelText("title").getAttribute("maxlength")).toBeNull();
  });
});

describe("int / float", () => {
  it("emits a number for int", () => {
    const { onChange } = renderOne(INT_FEATURE);
    fireEvent.change(screen.getByLabelText("year"), { target: { value: "2010" } });
    expect(onChange).toHaveBeenCalledWith("year", 2010);
  });

  it("emits a fractional number for float", () => {
    const { onChange } = renderOne(FLOAT_FEATURE);
    fireEvent.change(screen.getByLabelText("engine"), { target: { value: "2.5" } });
    expect(onChange).toHaveBeenCalledWith("engine", 2.5);
  });
});

describe("bool", () => {
  it("emits a boolean and shows the config's own captions", () => {
    const { onChange } = renderOne(BOOL_FEATURE, false);
    expect(screen.getByText("Fixed price")).toBeDefined();
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith("negotiable", true);
  });
});

describe("select — always a LIST, even for a single choice", () => {
  it("wraps a Segmented single choice in an array", () => {
    const { onChange } = renderOne(SELECT_FEATURE);
    fireEvent.click(screen.getByText("Diesel"));
    expect(onChange).toHaveBeenCalledWith("fuel", ["diesel"]);
  });

  it("renders a multi Select above the Segmented threshold and emits an array", () => {
    renderOne(MULTI_SELECT_FEATURE);
    // Five options and maxSelected 3 — a dropdown, not a segmented control.
    expect(screen.queryByText("Sunroof")).toBeNull();
    expect(screen.getByText("Choose")).toBeDefined();
  });

  it("shows the current selection", () => {
    renderOne(MULTI_SELECT_FEATURE, ["abs", "esp"]);
    expect(screen.getByTitle("ABS")).toBeDefined();
    expect(screen.getByTitle("ESP")).toBeDefined();
  });
});

describe("date — a Unix timestamp on the wire", () => {
  it("round-trips a timestamp through the native input value", () => {
    const seconds = inputValueToTimestamp("2010-06-15");
    expect(seconds).toBeTypeOf("number");
    expect(timestampToInputValue(seconds as number, "date")).toBe("2010-06-15");
    expect(timestampToInputValue(seconds as number, "month")).toBe("2010-06");
  });

  it("emits SECONDS, not an ISO string", () => {
    const { onChange } = renderOne(DATE_FEATURE);
    fireEvent.change(screen.getByLabelText("registered"), {
      target: { value: "2010-06-15" },
    });
    const [, emitted] = onChange.mock.calls[0] as [string, unknown];
    expect(emitted).toBeTypeOf("number");
    expect(new Date((emitted as number) * 1000).getFullYear()).toBe(2010);
  });

  it("clearing the field emits undefined, never 0 — 1970 is a real date", () => {
    const { onChange } = renderOne(DATE_FEATURE, 1_276_560_000);
    fireEvent.change(screen.getByLabelText("registered"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("registered", undefined);
    expect(inputValueToTimestamp("")).toBeUndefined();
  });

  it("year precision renders a number and still emits a timestamp", () => {
    const { onChange } = renderOne(feature("built", { type: "date", precision: "year" }));
    fireEvent.change(screen.getByLabelText("built"), { target: { value: "1998" } });
    const [, emitted] = onChange.mock.calls[0] as [string, unknown];
    expect(new Date((emitted as number) * 1000).getFullYear()).toBe(1998);
  });
});

describe("header — a caption, not a control", () => {
  it("renders a heading with no label, no required marker and no input", () => {
    renderOne(HEADER_FEATURE);
    expect(screen.getByRole("heading", { name: "engine section" })).toBeDefined();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

describe("hex_color — an object with a required colour category", () => {
  it("offers the category picker as the LABELLED control", () => {
    renderOne(HEX_COLOR_FEATURE);
    expect(screen.getByLabelText("colour")).toBeDefined();
  });

  it("shows the current category", () => {
    renderOne(HEX_COLOR_FEATURE, { simple: "red", hex: "#FF0000" });
    expect(screen.getByTitle("red")).toBeDefined();
  });
});

describe("hierarchical_select — a path array", () => {
  it("renders a cascader and shows the selected path", () => {
    renderOne(HIERARCHICAL_FEATURE, ["passenger", "sedan"]);
    expect(screen.getByLabelText("body")).toBeDefined();
    expect(screen.getByTitle("Passenger / Sedan")).toBeDefined();
  });
});

describe("convertible_unit — a number tagged with its unit", () => {
  it("emits {value, unit} and defaults the unit to the metric code", () => {
    const { onChange } = renderOne(CONVERTIBLE_FEATURE);
    fireEvent.change(screen.getByLabelText("length"), { target: { value: "4.2" } });
    expect(onChange).toHaveBeenCalledWith("length", { value: 4.2, unit: "m" });
  });

  it("keeps the submitted unit rather than converting client-side", () => {
    const { onChange } = renderOne(CONVERTIBLE_FEATURE, { value: 12, unit: "ft" });
    fireEvent.change(screen.getByLabelText("length"), { target: { value: "14" } });
    expect(onChange).toHaveBeenCalledWith("length", { value: 14, unit: "ft" });
  });
});

describe("every editor labels its control", () => {
  it("puts the row's htmlFor on an element the label resolves to", () => {
    for (const f of [
      STRING_FEATURE,
      INT_FEATURE,
      FLOAT_FEATURE,
      BOOL_FEATURE,
      SELECT_FEATURE,
      DATE_FEATURE,
      HEX_COLOR_FEATURE,
      HIERARCHICAL_FEATURE,
      CONVERTIBLE_FEATURE,
    ]) {
      renderOne(f);
      expect(screen.getByLabelText(f.name as string)).toBeDefined();
      cleanup();
    }
  });
});
