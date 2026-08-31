/**
 * The named sections as DISCLOSURES — `groupCollapse="auto"`.
 *
 * An imported catalogue is mostly plumbing. Measured on a live classified
 * deployment, the phone leaf carries 32 fields under seven headings, of which
 * four are parcel dimensions ("Weight (for delivery)", "Length…") and three
 * are wholesale terms; drawn open, the region alone is some 5000px and the
 * seller scrolls past every one of them.
 *
 * The default has to come from the SCHEMA and not from a list of group names:
 * a group is admin-authored text in the deployment's own language, so a
 * library that recognised the word "Delivery" would sort one deployment and
 * mis-sort every translated one. Requiredness is the machine-readable line,
 * and it falls where a person would draw it — what a listing cannot be
 * published without is what identifies the thing.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import type { FeatureDef } from "../src/types.js";
import { registerAttributesI18n } from "../src/i18n/keys.js";
import { FeatureFields, featureSectionTestId } from "../src/default/FeatureFields.js";
import { feature } from "./fixtures.js";

afterEach(() => cleanup());

function wrap(node: ReactElement): ReactElement {
  const i18n = createI18n({ locale: "en" });
  registerAttributesI18n(i18n);
  return <I18nProvider i18n={i18n}>{node}</I18nProvider>;
}

/** The shape of the imported leaf: an identity group carrying the required
 * questions, then two groups of pure commerce plumbing. */
const IDENTITY: readonly FeatureDef[] = [
  feature("vendor", { type: "string", maxLength: 40 }, { group: "About the phone", mandatory: true }),
  feature("model", { type: "string", maxLength: 40 }, { group: "About the phone" }),
];
const DELIVERY: readonly FeatureDef[] = [
  feature("weight", { type: "float", min: 0, max: 50 }, { group: "Delivery" }),
  feature("length", { type: "float", min: 0, max: 500 }, { group: "Delivery" }),
];
const WHOLESALE: readonly FeatureDef[] = [
  feature("pack_size", { type: "int", min: 1, max: 999 }, { group: "Wholesale" }),
];
const LEAF: readonly FeatureDef[] = [...IDENTITY, ...DELIVERY, ...WHOLESALE];

function section(group: string): HTMLElement {
  return screen.getByTestId(featureSectionTestId(group));
}

function isOpen(group: string): boolean {
  const node = section(group);
  expect(node.tagName).toBe("DETAILS");
  return (node as HTMLDetailsElement).open;
}

function renderLeaf(
  values: Readonly<Record<string, unknown>> = {},
  features: readonly FeatureDef[] = LEAF
): void {
  render(
    wrap(
      <FeatureFields
        features={features}
        values={values}
        onChange={() => {}}
        groupCollapse="auto"
      />
    )
  );
}

describe("what a collapsing form opens on the first frame", () => {
  it("opens the group that asks something the seller MUST answer", () => {
    renderLeaf();
    expect(isOpen("About the phone")).toBe(true);
  });

  it("closes the groups that are pure plumbing — and keeps their headings", () => {
    renderLeaf();
    expect(isOpen("Delivery")).toBe(false);
    expect(isOpen("Wholesale")).toBe(false);
    // Every heading is on screen either way: a section nobody can see is a
    // section nobody knows to open.
    expect(screen.getByTestId(`${featureSectionTestId("Delivery")}-heading`).textContent).toBe(
      "Delivery"
    );
    expect(screen.getByTestId(`${featureSectionTestId("Wholesale")}-heading`).textContent).toBe(
      "Wholesale"
    );
  });

  it("opens an optional group that has already been answered", () => {
    renderLeaf({ weight: 1.5 });
    expect(isOpen("Delivery")).toBe(true);
    expect(isOpen("Wholesale")).toBe(false);
  });

  it("reads an empty string and an empty list as no answer at all", () => {
    renderLeaf({ weight: "", length: [] });
    expect(isOpen("Delivery")).toBe(false);
  });

  it("opens a group a RULE has just made required", () => {
    const conditional: readonly FeatureDef[] = [
      feature("condition", { type: "string", maxLength: 10 }, { group: "About the phone", mandatory: true }),
      feature(
        "screen_flaws",
        { type: "string", maxLength: 40 },
        {
          group: "Faults",
          rules: [
            {
              effect: "require",
              when: { all: [{ feature: "condition", op: "in", values: ["used"] }] },
            },
          ],
        }
      ),
    ];
    renderLeaf({}, conditional);
    expect(isOpen("Faults")).toBe(false);

    cleanup();
    renderLeaf({ condition: "used" }, conditional);
    expect(isOpen("Faults")).toBe(true);
  });

  it("leaves the ungrouped rows alone — there is no heading to press", () => {
    render(
      wrap(
        <FeatureFields
          features={[feature("colour", { type: "string", maxLength: 10 }), ...DELIVERY]}
          values={{}}
          onChange={() => {}}
          groupCollapse="auto"
        />
      )
    );
    expect(screen.getByTestId(featureSectionTestId("")).tagName).toBe("DIV");
  });
});

describe("the person's own decision outranks the default", () => {
  /** What the browser does to a `<details>` when its summary is pressed: the
   * property flips, then `toggle` fires. */
  function press(group: string): void {
    const node = section(group) as HTMLDetailsElement;
    node.open = !node.open;
    fireEvent(node, new Event("toggle"));
  }

  function leaf(values: Readonly<Record<string, unknown>>): ReactElement {
    return wrap(
      <FeatureFields
        features={LEAF}
        values={values}
        onChange={() => {}}
        groupCollapse="auto"
      />
    );
  }

  it("keeps a section the person opened open across a re-render", () => {
    const { rerender } = render(leaf({}));
    expect(isOpen("Delivery")).toBe(false);
    press("Delivery");
    expect(isOpen("Delivery")).toBe(true);
    // Any unrelated answer re-renders the whole region.
    rerender(leaf({ model: "iPhone 13" }));
    expect(isOpen("Delivery")).toBe(true);
  });

  it("keeps a section the person closed closed, default or no default", () => {
    const { rerender } = render(leaf({}));
    expect(isOpen("About the phone")).toBe(true);
    press("About the phone");
    rerender(leaf({ model: "iPhone 13" }));
    expect(isOpen("About the phone")).toBe(false);
  });
});

describe("the default stays what it was", () => {
  it("draws every section open, as a plain block, without the prop", () => {
    render(wrap(<FeatureFields features={LEAF} values={{}} onChange={() => {}} />));
    for (const group of ["About the phone", "Delivery", "Wholesale"]) {
      expect(section(group).tagName).toBe("DIV");
    }
  });
});
