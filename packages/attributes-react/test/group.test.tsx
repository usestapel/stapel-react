/**
 * The composite (`group`) — the bordered subform, its mirror rule, and the
 * shape it puts on the wire.
 *
 * The value is a list of ROWS keyed by child slug, and the whole array travels
 * through the one `onChange` the editor owns: a cell edit re-emits the table,
 * never a second slug. Everything else is delegation — a cell is drawn by its
 * child's own editor and judged by its child's own mirror rule — so the tests
 * that matter are about the ROW: how many there may be, when the add and
 * remove controls exist, and what a blank row does.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import type { FeatureDef } from "../src/types.js";
import { registerAttributesI18n } from "../src/i18n/keys.js";
import { FeatureFields, featureControlId } from "../src/default/FeatureFields.js";
import { formatFeatureValue } from "../src/format.js";
import { toFeaturesDto } from "../src/dto.js";
import {
  featureAnswerRequired,
  groupChildren,
  groupRowBounds,
  mirrorValidate,
} from "../src/validate.js";
import { GROUP_FEATURE, SINGLE_ROW_GROUP_FEATURE, feature } from "./fixtures.js";

afterEach(() => cleanup());

function renderGroup(
  f: FeatureDef,
  value?: unknown,
  extra: { required?: boolean } = {}
): { onChange: ReturnType<typeof vi.fn> } {
  const onChange = vi.fn();
  const i18n = createI18n({ locale: "en" });
  registerAttributesI18n(i18n);
  const drawn: FeatureDef = extra.required === true ? { ...f, mandatory: true } : f;
  const node: ReactElement = (
    <I18nProvider i18n={i18n}>
      <FeatureFields
        features={[drawn]}
        values={value === undefined ? {} : { [f.slug]: value }}
        onChange={(slug, next) => onChange(slug, next)}
      />
    </I18nProvider>
  );
  render(node);
  return { onChange };
}

function rowNodes(): readonly HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-attributes-row]"));
}

// ── config readers, shared by both halves ───────────────────────────────────

describe("the config readers the two halves share", () => {
  it("reads the children out of `fields`, ignoring anything that is not a feature", () => {
    const config = { type: "group", fields: [{ slug: "a", config: {} }, 7, null] };
    expect(groupChildren(config).map((child) => child.slug)).toEqual(["a"]);
  });

  it("`repeat: null` is a SINGLE-row group, not an unbounded one", () => {
    expect(groupRowBounds({ type: "group", repeat: null })).toEqual([0, 1]);
    expect(groupRowBounds({ type: "group" })).toEqual([0, 1]);
    expect(groupRowBounds({ type: "group", repeat: { min: 1, max: 5 } })).toEqual([1, 5]);
    expect(groupRowBounds({ type: "group", repeat: { min: 2 } })).toEqual([2, undefined]);
  });
});

// ── drawing ─────────────────────────────────────────────────────────────────

describe("the subform", () => {
  it("draws one bordered row per stored row, with the children as cells", () => {
    renderGroup(GROUP_FEATURE, [
      { quantity: 10, discount: 5 },
      { quantity: 50, discount: 12 },
    ]);
    expect(rowNodes()).toHaveLength(2);
    // "quantity *" — the asterisk is decorative chrome inside the cell's label.
    expect(within(rowNodes()[0] as HTMLElement).getByLabelText(/quantity/)).toBeTruthy();
    expect(within(rowNodes()[1] as HTMLElement).getByLabelText("discount")).toBeTruthy();
  });

  it("puts the row's id on the CONTAINER — a composite has no primary control", () => {
    renderGroup(GROUP_FEATURE, [{ quantity: 10 }]);
    const container = document.getElementById(featureControlId(GROUP_FEATURE.slug));
    expect(container).toBeTruthy();
    expect(container?.getAttribute("role")).toBe("group");
  });

  it("draws a cell with the child's OWN editor, bounds included", () => {
    renderGroup(GROUP_FEATURE, [{ quantity: 10, discount: 5 }]);
    // `int` with min/max — the same control a top-level int row would get.
    const cell = screen.getAllByLabelText(/quantity/)[0] as HTMLElement;
    expect(cell.getAttribute("aria-valuemin")).toBe("1");
    expect(cell.getAttribute("aria-valuemax")).toBe("10000000");
  });

  it("marks a mandatory child, and only a mandatory one", () => {
    renderGroup(GROUP_FEATURE, [{ quantity: 10 }]);
    const row = rowNodes()[0] as HTMLElement;
    expect(within(row).getByLabelText(/quantity/).getAttribute("aria-required")).toBe("true");
    expect(within(row).getByLabelText("discount").getAttribute("aria-required")).toBeNull();
  });
});

// ── add / remove ────────────────────────────────────────────────────────────

describe("add and remove", () => {
  it("adds a row, and stops at repeat.max rather than offering one the server would refuse", () => {
    const rows = [1, 2, 3, 4, 5].map((n) => ({ quantity: n * 10, discount: n }));
    renderGroup(GROUP_FEATURE, rows);
    expect(rowNodes()).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Add row" }).hasAttribute("disabled")).toBe(true);
  });

  it("emits the table with one more row when the add button is pressed", () => {
    const { onChange } = renderGroup(GROUP_FEATURE, [{ quantity: 10, discount: 5 }]);
    fireEvent.click(screen.getByRole("button", { name: "Add row" }));
    // The blank row carries nothing, so it is not emitted — a row becomes real
    // when a cell is filled in, not when a button is pressed.
    expect(onChange).toHaveBeenCalledWith("discount_ladder", [{ quantity: 10, discount: 5 }]);
  });

  it("removes the row that was pressed", () => {
    const { onChange } = renderGroup(GROUP_FEATURE, [
      { quantity: 10, discount: 5 },
      { quantity: 50, discount: 12 },
    ]);
    const remove = screen.getAllByRole("button", { name: "Remove" });
    expect(remove).toHaveLength(2);
    fireEvent.click(remove[1] as HTMLElement);
    expect(onChange).toHaveBeenCalledWith("discount_ladder", [{ quantity: 10, discount: 5 }]);
  });

  it("offers no remove at repeat.min — an unpressable control is worse than none", () => {
    renderGroup(GROUP_FEATURE, [{ quantity: 10, discount: 5 }]);
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("a single-row group has no add, no remove and no row numbers", () => {
    renderGroup(SINGLE_ROW_GROUP_FEATURE, [{ months: 24 }]);
    expect(screen.queryByRole("button", { name: "Add row" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(screen.queryByText("Row 1")).toBeNull();
    expect(rowNodes()).toHaveLength(1);
  });

  it("a single-row group draws its one row even with no answer yet", () => {
    renderGroup(SINGLE_ROW_GROUP_FEATURE);
    expect(rowNodes()).toHaveLength(1);
    expect(screen.getByLabelText("months")).toBeTruthy();
  });

  it("a repeatable group with no answer draws a blank row only when required", () => {
    renderGroup(GROUP_FEATURE);
    expect(rowNodes()).toHaveLength(0);
    cleanup();
    renderGroup(GROUP_FEATURE, undefined, { required: true });
    expect(rowNodes()).toHaveLength(1);
  });
});

// ── the value on the wire ───────────────────────────────────────────────────

describe("the value", () => {
  it("a cell edit re-emits the whole table under the group's own slug", () => {
    const { onChange } = renderGroup(GROUP_FEATURE, [
      { quantity: 10, discount: 5 },
      { quantity: 50, discount: 12 },
    ]);
    const second = rowNodes()[1] as HTMLElement;
    fireEvent.change(within(second).getByLabelText("discount"), { target: { value: "20" } });
    expect(onChange).toHaveBeenCalledWith("discount_ladder", [
      { quantity: 10, discount: 5 },
      { quantity: 50, discount: 20 },
    ]);
  });

  it("clearing the last cell of the last row empties the answer rather than storing a blank row", () => {
    const { onChange } = renderGroup(GROUP_FEATURE, [{ quantity: 10 }]);
    fireEvent.change(screen.getByLabelText(/quantity/), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("discount_ladder", undefined);
  });

  it("rides the `{type, value}` envelope like every other type", () => {
    const rows = [{ quantity: 10, discount: 5 }];
    expect(toFeaturesDto([GROUP_FEATURE], { discount_ladder: rows })).toEqual({
      discount_ladder: { type: "group", value: rows },
    });
    // An empty table is "not answered", so the key is omitted entirely.
    expect(toFeaturesDto([GROUP_FEATURE], { discount_ladder: [] })).toEqual({});
  });
});

// ── the mirror ──────────────────────────────────────────────────────────────

describe("the mirror", () => {
  function verdict(value: unknown, f: FeatureDef = GROUP_FEATURE) {
    return mirrorValidate([f], { [f.slug]: { type: "group", value } }).results[0];
  }

  it("accepts a table inside its bounds", () => {
    expect(verdict([{ quantity: 10, discount: 5 }])?.status).toBe("ok");
  });

  it("refuses more rows than repeat.max, naming the cap", () => {
    const rows = [1, 2, 3, 4, 5, 6].map((n) => ({ quantity: n }));
    const row = verdict(rows);
    expect(row?.status).toBe("validation_failed");
    expect(row?.error).toBe("above_maximum");
    expect(row?.ref_value).toBe(5);
  });

  it("refuses fewer rows than repeat.min", () => {
    const f = feature("steps", {
      type: "group",
      fields: [feature("a", { type: "int" })],
      repeat: { min: 2, max: 4 },
    });
    const row = verdict([{ a: 1 }], f);
    expect(row?.error).toBe("below_minimum");
    expect(row?.ref_value).toBe(2);
  });

  it("refuses a second row when `repeat` is null", () => {
    const row = verdict([{ months: 12 }, { months: 24 }], SINGLE_ROW_GROUP_FEATURE);
    expect(row?.error).toBe("above_maximum");
    expect(row?.ref_value).toBe(1);
  });

  it("carries the CHILD's own refusal up — the composite adds no error vocabulary", () => {
    const row = verdict([{ quantity: 10, discount: 99 }]);
    expect(row?.error).toBe("above_maximum");
    expect(row?.ref_value).toBe(30);
  });

  it("refuses a row missing a mandatory child", () => {
    expect(verdict([{ discount: 5 }])?.error).toBe("mandatory_missing");
  });

  it("refuses a row carrying a field the group does not declare", () => {
    const row = verdict([{ quantity: 10, typo: 1 }]);
    expect(row?.error).toBe("invalid_format");
    expect(row?.ref_value).toEqual(["typo"]);
  });

  it("refuses a value that is not a list of rows", () => {
    expect(verdict({ quantity: 10 })?.error).toBe("invalid_type");
    expect(verdict(["not a row"])?.error).toBe("invalid_format");
  });

  it("an empty table is an absent answer, required only when the row says so", () => {
    expect(verdict([])?.status).toBe("ok");
    expect(featureAnswerRequired(GROUP_FEATURE)).toBe(false);
    expect(featureAnswerRequired({ ...GROUP_FEATURE, mandatory: true })).toBe(true);
    const required = mirrorValidate([{ ...GROUP_FEATURE, mandatory: true }], {
      discount_ladder: { type: "group", value: [] },
    });
    expect(required.results[0]?.error).toBe("mandatory_missing");
  });
});

// ── display ─────────────────────────────────────────────────────────────────

describe("display", () => {
  it("formats each cell through its own child's type, rows separated", () => {
    const text = formatFeatureValue(GROUP_FEATURE, {
      type: "group",
      value: [
        { quantity: 10, discount: 5 },
        { quantity: 50, discount: 12 },
      ],
    });
    expect(text).toBe("quantity: 10, discount: 5 %; quantity: 50, discount: 12 %");
  });

  it("reads a STORED row, whose cells are the children's own DAOs", () => {
    const text = formatFeatureValue(GROUP_FEATURE, {
      type: "group",
      value: [
        {
          quantity: { type: "int", value: 10, name: "From, units", order: 0 },
          discount: { type: "int", value: 5, name: "Discount", order: 1 },
        },
      ],
    });
    // The stored `name` wins over the config's: it is what the catalogue said
    // when the listing was saved.
    expect(text).toBe("From, units: 10, Discount: 5 %");
  });

  it("keeps a cell the config no longer declares rather than printing a blank", () => {
    const text = formatFeatureValue(GROUP_FEATURE, {
      type: "group",
      value: [{ retired: { type: "int", value: 3, name: "Retired" } }],
    });
    expect(text).toBe("Retired: 3");
  });

  it("an empty table shows nothing at all", () => {
    expect(formatFeatureValue(GROUP_FEATURE, { type: "group", value: [] })).toBeUndefined();
  });
});
