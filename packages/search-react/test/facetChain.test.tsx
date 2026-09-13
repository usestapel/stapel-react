/**
 * THE DICTIONARY CHAIN IS STRICTLY SEQUENTIAL — a model axis is not
 * selectable until a make is chosen, and the control that is switched off
 * says which one to use first.
 *
 * The founder read the live site on 2026-09-13 and found every rung of a
 * catalogue's chain offered at once: a model could be picked with no make, so
 * the values on offer were the models of every make in the catalogue and the
 * press led to an empty feed. The composer has refused to draw such a field
 * since `@stapel/attributes-react` shipped `dependencyParentOf`; the search
 * side had no rule at all.
 *
 * WHAT THESE TESTS ASSERT — the OUTCOME, never the wiring:
 *
 *  - which controls a person can press (`disabled` on the DOM node, the
 *    values missing from the DOM entirely), and
 *  - that the reason is on screen and NAMES the parent by the parent's own
 *    heading — not "unavailable", not a bare greyed box.
 *
 * WHAT THEY CANNOT SEE. jsdom lays no text out and paints nothing, so nothing
 * here is evidence about how the switched-off group LOOKS — its greying, its
 * contrast against the rail, or whether the hint wraps in a 280px column.
 * They are evidence about which controls exist and what they say.
 *
 * The chain is read off the catalogue's own pointer
 * (`config.optionsRef.parentFeature`). Nothing in this suite names a car:
 * `parent`/`child` are the fixture's slugs on purpose, so a rule that
 * special-cased makes and models would fail it.
 */
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import type { FeatureDef } from "@stapel/attributes-react";
import { buildFacetGroups, facetParentSlug, parseSearchState } from "../src/index.js";
import type { FacetGroup } from "../src/index.js";
import { FacetGroupControl, PopularValues } from "../src/default/index.js";
import { searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

const OPTIONS = { defaultType: "listing" } as const;

/** The rung above: a plain vocabulary axis, nobody's child. */
const PARENT: FeatureDef = {
  slug: "parent",
  name: "Parent axis",
  config: {
    type: "ref_select",
    optionsRef: { level: "Parent", vocabulary: "catalog" },
  },
};

/** The rung below, scoped BY the one above — the whole of the declaration
 * this rule reads. */
const CHILD: FeatureDef = {
  slug: "child",
  name: "Child axis",
  config: {
    type: "ref_select",
    optionsRef: {
      level: "Child",
      vocabulary: "catalog",
      parentFeature: "parent",
    },
  },
};

/** A child whose declared parent is not an axis of this page at all. */
const ORPHAN: FeatureDef = {
  slug: "orphan",
  name: "Orphan axis",
  config: {
    type: "ref_select",
    optionsRef: {
      level: "Child",
      vocabulary: "catalog",
      parentFeature: "nobody",
    },
  },
};

const PARENT_COUNTS: Readonly<Record<string, number>> = {
  alfa: 90,
  bravo: 80,
  charlie: 70,
};

/** Nine buckets, so the child would be a full dictionary if it were drawn. */
const CHILD_COUNTS: Readonly<Record<string, number>> = {
  "alfa-one": 40,
  "alfa-two": 30,
  "bravo-one": 20,
  "bravo-two": 18,
  "charlie-one": 16,
  "charlie-two": 14,
  "charlie-three": 12,
  "charlie-four": 10,
  "charlie-five": 8,
};

function groups(
  search: string,
  features: readonly FeatureDef[] = [PARENT, CHILD]
): readonly FacetGroup[] {
  return buildFacetGroups({
    facets: { parent: PARENT_COUNTS, child: CHILD_COUNTS, orphan: CHILD_COUNTS },
    meta: {
      approximate: false,
      candidates: 200,
      counted: ["parent", "child", "orphan"],
      skipped: [],
      dropped_filters: [],
      core_ranges: [],
      plan: "category",
      withheld: [],
      categories: [],
    },
    state: parseSearchState(new URLSearchParams(search), OPTIONS).state,
    facetLabels: {
      parent: { label: "Марка", translatable: false, values: {} },
      child: { label: "Модель", translatable: false, values: {} },
      orphan: { label: "Orphan", translatable: false, values: {} },
    },
    categoryFeatures: features,
  });
}

function group(search: string, slug: string, features?: readonly FeatureDef[]): FacetGroup {
  const found = groups(search, features).find((one) => one.slug === slug);
  if (found === undefined) throw new Error(`no ${slug} group`);
  return found;
}

function mount(node: ReactElement): void {
  render(
    <TestHarness server={mockServer({ "/query": { body: searchResponse() } })}>
      {node}
    </TestHarness>
  );
}

describe("the chain comes from the catalogue, not from a list of car words", () => {
  it("reads the parent off the feature's own optionsRef pointer", () => {
    expect(facetParentSlug(group("type=listing", "child"))).toBe("parent");
    expect(facetParentSlug(group("type=listing", "parent"))).toBeUndefined();
  });

  it("gates the child while the parent carries no value", () => {
    expect(group("type=listing", "child").awaitingParent).toEqual({
      slug: "parent",
      label: "Марка",
    });
  });

  it("releases it the moment the parent is answered", () => {
    expect(group("type=listing&f.parent=alfa", "child").awaitingParent).toBeUndefined();
  });

  it("never gates the parent itself", () => {
    expect(group("type=listing", "parent").awaitingParent).toBeUndefined();
  });

  it("gates NOTHING on a pointer to an axis this page does not have", () => {
    // The composer's own asymmetry: a gate on a slug nobody can ever answer
    // is a control switched off forever with no way to switch it back on.
    expect(group("type=listing", "orphan", [PARENT, ORPHAN]).awaitingParent).toBeUndefined();
  });
});

describe("the rail — a switched-off axis says which one to use first", () => {
  it("offers no child value and names the parent", () => {
    mount(
      <FacetGroupControl
        group={group("type=listing", "child")}
        onToggle={() => undefined}
        dictionaryMode="inline"
      />
    );
    // The axis is still ON THE PAGE: a rail is a map of what a category can
    // be narrowed by, and an axis that vanishes is a rail that moves.
    expect(screen.getByTestId("facet-group-child")).toBeTruthy();
    // Not one of its nine values is pressable, because not one of them is
    // there.
    expect(screen.queryAllByTestId(/^facet-option-child-/)).toHaveLength(0);
    // The box a person would type into is present and refuses the keystroke,
    // rather than being absent (which reads as "this axis has no search").
    const box = screen.getByTestId("facet-dictionary-search-child");
    expect(box.hasAttribute("disabled")).toBe(true);
    // And the reason NAMES the control to use first, by its own heading.
    const why = screen.getByTestId("facet-parent-first-child");
    expect(why.textContent).toContain("Марка");
    expect(why.getAttribute("data-parent")).toBe("parent");
  });

  it("draws the ordinary searchable list once the parent is answered", () => {
    mount(
      <FacetGroupControl
        group={group("type=listing&f.parent=alfa", "child")}
        onToggle={() => undefined}
        dictionaryMode="inline"
      />
    );
    expect(screen.queryByTestId("facet-parent-first-child")).toBeNull();
    expect(
      screen.getByTestId("facet-dictionary-search-child").hasAttribute("disabled")
    ).toBe(false);
    expect(screen.queryAllByTestId(/^facet-option-child-/).length).toBeGreaterThan(0);
  });

  it("holds in the PHONE sheet's real shape — the picker the panel mounts", () => {
    // `sheet` WITH `onSetValues` is what `<FacetPanelPane>` passes below the
    // breakpoint: the nested picker over the shared sheet component. A gate
    // that only covered the fallback would leave the phone offering every
    // model of every make, which is the surface the founder was on.
    mount(
      <FacetGroupControl
        group={group("type=listing", "child")}
        onToggle={() => undefined}
        onSetValues={() => undefined}
        dictionaryMode="sheet"
      />
    );
    expect(screen.getByTestId("facet-parent-first-child").textContent).toContain("Марка");
    expect(screen.queryAllByTestId(/^facet-option-child-/)).toHaveLength(0);
    expect(screen.queryByTestId("facet-dictionary-trigger-child")).toBeNull();
  });

  it("holds in the sheet's FALLBACK shape too", () => {
    // Same group, the other surface. `sheet` without `onSetValues` falls back
    // to the closed field, which is the third shape this rule has to survive.
    mount(
      <FacetGroupControl
        group={group("type=listing", "child")}
        onToggle={() => undefined}
        dictionaryMode="sheet"
      />
    );
    expect(screen.getByTestId("facet-parent-first-child").textContent).toContain("Марка");
    expect(screen.queryAllByTestId(/^facet-option-child-/)).toHaveLength(0);
    // No closed field to press either: a trigger that opens a list of every
    // model of every make is the offer this gate exists to withdraw.
    expect(screen.queryByTestId("facet-dictionary-field-child")).toBeNull();
  });

  it("switches off the ROWS of a chained axis a catalogue draws as a tree", () => {
    // Not every chained axis is a dictionary: a `hierarchical_select` is drawn
    // as nested rows whatever its pointer says, and the gate has to reach that
    // shape too. The rows stay on screen — a person can see what the axis
    // holds — and not one of them can be pressed.
    const inlineChild: FeatureDef = {
      slug: "child",
      name: "Child axis",
      config: {
        type: "hierarchical_select",
        optionsRef: {
          level: "Child",
          vocabulary: "catalog",
          parentFeature: "parent",
        },
        options: [
          { value: "alfa-one", label: "Alfa One" },
          { value: "alfa-two", label: "Alfa Two" },
        ],
      },
    };
    mount(
      <FacetGroupControl
        group={group("type=listing", "child", [PARENT, inlineChild])}
        onToggle={() => undefined}
      />
    );
    const rows = screen.queryAllByTestId(/^facet-option-child-/);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.hasAttribute("disabled")).toBe(true);
    expect(screen.getByTestId("facet-parent-first-child").textContent).toContain("Марка");
  });
});

describe("the popular-values band obeys the same chain", () => {
  it("prints no value of a chained axis while its parent is unanswered", () => {
    mount(
      <PopularValues
        group={group("type=listing", "child")}
        onApply={() => undefined}
      />
    );
    expect(screen.queryAllByTestId(/^popular-value-child-/)).toHaveLength(0);
    expect(screen.getByTestId("popular-parent-first-child").textContent).toContain(
      "Марка"
    );
  });

  it("prints them once the parent is answered", () => {
    mount(
      <PopularValues
        group={group("type=listing&f.parent=alfa", "child")}
        onApply={() => undefined}
      />
    );
    expect(screen.queryByTestId("popular-parent-first-child")).toBeNull();
    expect(screen.queryAllByTestId(/^popular-value-child-/).length).toBeGreaterThan(0);
  });
});
