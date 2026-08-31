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
import {
  FeatureFields,
  UNGROUPED_SECTION,
  featureControlId,
  featureRowTestId,
  featureSectionTestId,
  featureSections,
} from "../src/default/FeatureFields.js";
import { HEADER_FEATURE, INT_FEATURE, STRING_FEATURE, feature } from "./fixtures.js";

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
    // The host's own `<label htmlFor>` points at the control the ladder built.
    // Asserted by id rather than by label TEXT: `title` carries a maxLength, so
    // the control renders antd's code-point counter inside the wrapping label
    // and the label's accessible text is "title" plus the count.
    expect(screen.getByRole("textbox").id).toBe(featureControlId("title"));
  });
});

// ── the rule pre-pass, drawn ─────────────────────────────────────────────────

const CONDITION = feature("condition", {
  type: "select",
  maxSelected: 1,
  translatable_options: false,
  options: [
    { value: "new", label: "New" },
    { value: "used", label: "Used" },
  ],
});

const SCREEN_STATE = feature(
  "screen_state",
  { type: "string" },
  {
    rules: [
      { effect: "show", when: { all: [{ feature: "condition", op: "in", values: ["used"] }] } },
      { effect: "require", when: { all: [{ feature: "condition", op: "in", values: ["used"] }] } },
    ],
  }
);

const DELIVERY = feature(
  "delivery",
  {
    type: "select",
    maxSelected: 1,
    translatable_options: false,
    options: [
      { value: "pickup", label: "Pickup" },
      { value: "post", label: "Post" },
    ],
  },
  {
    rules: [
      {
        effect: "forbid_option",
        option: "post",
        when: { all: [{ feature: "condition", op: "in", values: ["used"] }] },
      },
    ],
  }
);

const WEIGHT = feature(
  "weight",
  { type: "int", min: 1, max: 100 },
  {
    rules: [
      {
        effect: "limit",
        max: 10,
        when: { all: [{ feature: "condition", op: "in", values: ["used"] }] },
      },
    ],
  }
);

describe("rules decide what is on screen", () => {
  const features = [CONDITION, SCREEN_STATE];

  it("does not render a hidden row at all", () => {
    render(
      wrap(
        <FeatureFields features={features} values={{ condition: ["new"] }} onChange={() => {}} />
      )
    );
    expect(screen.queryByLabelText("screen state")).toBeNull();
  });

  it("renders it, and marks it required, once the controlling answer matches", () => {
    const { container } = render(
      wrap(
        <FeatureFields features={features} values={{ condition: ["used"] }} onChange={() => {}} />
      )
    );
    expect(screen.getByLabelText("screen state")).toBeDefined();
    // `mandatory` is false on this feature: the asterisk comes from the RULE,
    // which is the whole point of the pre-pass.
    expect(container.querySelectorAll(".ant-form-item-required")).toHaveLength(1);
  });

  it("hands the editor a config the rules already narrowed", () => {
    // A forbidden option is not OFFERED — the alternative is a control that
    // shows a choice the mirror is already going to refuse.
    render(
      wrap(
        <FeatureFields
          features={[CONDITION, DELIVERY]}
          values={{ condition: ["used"] }}
          onChange={() => {}}
        />
      )
    );
    fireEvent.mouseDown(screen.getAllByRole("combobox")[1] as HTMLElement);
    expect(screen.getByTitle("Pickup")).toBeDefined();
    expect(screen.queryByTitle("Post")).toBeNull();
  });

  it("puts a narrowed bound on the control", () => {
    render(
      wrap(
        <FeatureFields
          features={[CONDITION, WEIGHT]}
          values={{ condition: ["used"] }}
          onChange={() => {}}
        />
      )
    );
    const input = screen.getByLabelText("weight");
    expect(input.getAttribute("aria-valuemax")).toBe("10");
  });
});

// ── form metadata (§9 D9) ────────────────────────────────────────────────────

describe("form metadata", () => {
  const described = feature(
    "width",
    { type: "int" },
    {
      description: "Measured at the widest point.",
      example: "e.g. 120",
      hints: [
        { title: "Do not include", content: "the packaging" },
        { title: "", content: "Round to the nearest centimetre" },
      ],
    }
  );

  it("renders description as the field's help text", () => {
    render(wrap(<FeatureFields features={[described]} values={{}} onChange={() => {}} />));
    expect(screen.getByText("Measured at the widest point.")).toBeDefined();
  });

  it("uses example as the control's placeholder — for the types that have one", () => {
    render(wrap(<FeatureFields features={[described]} values={{}} onChange={() => {}} />));
    expect(screen.getByLabelText("width").getAttribute("placeholder")).toBe("e.g. 120");
    // A `select` has no text box an example would mean anything in.
    cleanup();
    render(
      wrap(
        <FeatureFields
          features={[{ ...CONDITION, example: "e.g. used" }]}
          values={{}}
          onChange={() => {}}
        />
      )
    );
    expect(screen.getByRole("combobox").getAttribute("placeholder")).not.toBe("e.g. used");
  });

  it("renders every hint in ONE info alert, not one box per hint", () => {
    render(wrap(<FeatureFields features={[described]} values={{}} onChange={() => {}} />));
    const hints = screen.getAllByTestId("attributes-hints");
    expect(hints).toHaveLength(1);
    expect(hints[0]?.textContent).toContain("the packaging");
    expect(hints[0]?.textContent).toContain("Round to the nearest centimetre");
  });

  it("no longer renders FeatureDef.comment anywhere — one field, one role", () => {
    render(
      wrap(
        <FeatureFields
          features={[{ ...STRING_FEATURE, comment: "an admin note nobody asked for" }]}
          values={{}}
          onChange={() => {}}
        />
      )
    );
    expect(screen.queryByText("an admin note nobody asked for")).toBeNull();
  });
});

describe("sections", () => {
  const grouped = [
    feature("title", { type: "string" }),
    feature("power", { type: "int" }, { group: "Engine" }),
    feature("scratches", { type: "string" }, { group: "Condition" }),
    feature("torque", { type: "int" }, { group: "Engine" }),
  ];

  it("orders sections by first appearance, ungrouped first and unheaded", () => {
    expect(featureSections(grouped).map((section) => section.group)).toEqual([
      "",
      "Engine",
      "Condition",
    ]);
    expect(featureSections(grouped)[1]?.rows.map((row) => row.slug)).toEqual([
      "power",
      "torque",
    ]);
  });

  it("draws a heading per group and none for the ungrouped rows", () => {
    render(wrap(<FeatureFields features={grouped} values={{}} onChange={() => {}} />));
    const headings = screen.getAllByRole("heading");
    expect(headings.map((one) => one.textContent)).toEqual(["Engine", "Condition"]);
  });

  it("drops a section whose every row is hidden, heading and all", () => {
    const hidden = feature(
      "scratches",
      { type: "string" },
      {
        group: "Condition",
        rules: [
          { effect: "show", when: { all: [{ feature: "condition", op: "in", values: ["used"] }] } },
        ],
      }
    );
    render(
      wrap(
        <FeatureFields
          features={[CONDITION, hidden]}
          values={{ condition: ["new"] }}
          onChange={() => {}}
        />
      )
    );
    expect(screen.queryByRole("heading", { name: "Condition" })).toBeNull();
  });
});

/**
 * The attribute region is MEASURABLE.
 *
 * On a live classified deployment the composer's characteristics region is
 * 25 rows under 6 headings, some 5000px tall, and the whole of it carried one
 * test id — on an alert that only appears when a field has hints. A region
 * nothing can select is a region nothing can assert about, which is why every
 * defect in it was found by a person scrolling a phone.
 */
describe("stable test ids over the region", () => {
  const grouped = [
    feature("title", { type: "string" }),
    feature("power", { type: "int" }, { group: "Engine" }),
    feature("scratches", { type: "string" }, { group: "Condition" }),
  ];

  it("keys the container, every section, every heading and every field", () => {
    render(wrap(<FeatureFields features={grouped} values={{}} onChange={() => {}} />));
    expect(screen.getByTestId("attributes-fields")).toBeDefined();
    // The ungrouped rows are a section too — they have no heading, so without
    // a key of their own there is nothing to say "the questions before the
    // first heading rendered".
    expect(screen.getByTestId(featureSectionTestId(""))).toBeDefined();
    expect(screen.getByTestId(featureSectionTestId(""))).toBe(
      screen.getByTestId(`attributes-group-${UNGROUPED_SECTION}`)
    );
    for (const group of ["Engine", "Condition"]) {
      expect(screen.getByTestId(featureSectionTestId(group))).toBeDefined();
      expect(
        screen.getByTestId(`${featureSectionTestId(group)}-heading`).textContent
      ).toBe(group);
    }
    for (const slug of ["title", "power", "scratches"]) {
      expect(screen.getByTestId(featureRowTestId(slug))).toBeDefined();
    }
  });

  it("puts each row inside the section its group declares", () => {
    render(wrap(<FeatureFields features={grouped} values={{}} onChange={() => {}} />));
    expect(
      screen
        .getByTestId(featureSectionTestId("Engine"))
        .contains(screen.getByTestId(featureRowTestId("power")))
    ).toBe(true);
    expect(
      screen
        .getByTestId(featureSectionTestId("Condition"))
        .contains(screen.getByTestId(featureRowTestId("power")))
    ).toBe(false);
  });

  it("keys the row the same way when the host draws its own chrome", () => {
    render(
      wrap(
        <FeatureFields
          features={grouped}
          values={{}}
          onChange={() => {}}
          renderRow={(row) => <div>{row.control}</div>}
        />
      )
    );
    expect(screen.getByTestId(featureRowTestId("power"))).toBeDefined();
  });

  it("has no section, and therefore no key, for a group whose rows are all hidden", () => {
    const hidden = feature(
      "scratches",
      { type: "string" },
      {
        group: "Condition",
        rules: [
          { effect: "show", when: { all: [{ feature: "condition", op: "in", values: ["used"] }] } },
        ],
      }
    );
    render(
      wrap(
        <FeatureFields
          features={[CONDITION, hidden]}
          values={{ condition: ["new"] }}
          onChange={() => {}}
        />
      )
    );
    expect(screen.queryByTestId(featureSectionTestId("Condition"))).toBeNull();
    expect(screen.queryByTestId(featureRowTestId("scratches"))).toBeNull();
  });
});
