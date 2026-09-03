/**
 * The widget registry — coverage of the ten allowed kinds, the resolution
 * ladder, and the loud fallback.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import {
  ALLOWED_FIELD_KINDS,
  registerFormFieldWidget,
  registeredFormFieldKinds,
  resolveFormFieldWidget,
  unregisterFormFieldWidget,
} from "../src/index.js";
import type { FormFieldWidgetProps } from "../src/index.js";
import { BUILTIN_FIELD_KINDS, BUILTIN_FIELD_WIDGETS, StapelForm } from "../src/default/index.js";
import { TestHarness, mockServer } from "./harness.js";
import { NAME_FIELD, PUBLIC_ID, publicForm } from "./fixtures.js";

afterEach(() => {
  for (const kind of registeredFormFieldKinds()) unregisterFormFieldWidget(kind);
});

describe("coverage of the allowed field kinds", () => {
  it("the skin ships a builtin for EVERY kind stapel-forms allows", () => {
    // STAPEL_FORMS["FIELD_KINDS"] — conf.py::DEFAULT_FIELD_KINDS. A kind the
    // backend accepts but the skin cannot draw would reach a person as an
    // "unsupported field" notice on a live form.
    const missing = ALLOWED_FIELD_KINDS.filter(
      (kind) => BUILTIN_FIELD_WIDGETS[kind] === undefined
    );
    expect(missing).toEqual([]);
    expect(ALLOWED_FIELD_KINDS.length).toBe(10);
  });

  it("advertises exactly what it can draw", () => {
    expect([...BUILTIN_FIELD_KINDS].sort()).toEqual(
      [...ALLOWED_FIELD_KINDS].sort()
    );
  });
});

describe("the resolution ladder", () => {
  function Custom(props: FormFieldWidgetProps): ReactElement {
    return <div data-testid="custom-widget">{props.field.slug}</div>;
  }

  it("resolves to null with no explicit registration (the skin's builtin wins)", () => {
    expect(resolveFormFieldWidget("string")).toBeNull();
  });

  it("an explicit registration OUTRANKS the skin's builtin — override without fork", async () => {
    registerFormFieldWidget("string", Custom);
    expect(resolveFormFieldWidget("string")).toBe(Custom);

    const server = mockServer({
      [`GET /public/${PUBLIC_ID}/`]: {
        body: publicForm({ fields: [NAME_FIELD] }),
      },
    });
    render(
      <TestHarness server={server}>
        <StapelForm publicId={PUBLIC_ID} />
      </TestHarness>
    );
    expect(await screen.findByTestId("custom-widget")).toBeTruthy();
  });

  it("unregistering restores the builtin", () => {
    registerFormFieldWidget("string", Custom);
    unregisterFormFieldWidget("string");
    expect(resolveFormFieldWidget("string")).toBeNull();
  });

  it("a host can register a kind the backend added and the pair never knew", async () => {
    registerFormFieldWidget("signature", Custom);
    const server = mockServer({
      [`GET /public/${PUBLIC_ID}/`]: {
        body: publicForm({
          fields: [{ slug: "sig", kind: "signature", name: "Sign" }],
        }),
      },
    });
    render(
      <TestHarness server={server}>
        <StapelForm publicId={PUBLIC_ID} />
      </TestHarness>
    );
    expect(await screen.findByTestId("custom-widget")).toBeTruthy();
    // And the submit is no longer blocked, because nothing is unsupported.
    await waitFor(() =>
      expect(screen.queryByTestId("forms-unsupported-field")).toBeNull()
    );
  });
});

describe("the loud fallback", () => {
  it("renders a NOTICE for an unknown kind — never a skipped field, never a crash", async () => {
    const server = mockServer({
      [`GET /public/${PUBLIC_ID}/`]: {
        body: publicForm({
          fields: [NAME_FIELD, { slug: "sig", kind: "signature", name: "Sign" }],
        }),
      },
    });
    render(
      <TestHarness server={server}>
        <StapelForm publicId={PUBLIC_ID} />
      </TestHarness>
    );
    expect(await screen.findByTestId("forms-unsupported-field")).toBeTruthy();
    // The rest of the form still renders — one bad kind does not take the page.
    expect(screen.getByTestId("forms-form")).toBeTruthy();
  });

  it("blocks the submit with a readable reason while such a field is present", async () => {
    const server = mockServer({
      [`GET /public/${PUBLIC_ID}/`]: {
        body: publicForm({
          fields: [{ slug: "sig", kind: "signature", name: "Sign" }],
        }),
      },
    });
    render(
      <TestHarness server={server}>
        <StapelForm publicId={PUBLIC_ID} />
      </TestHarness>
    );
    // The reason lives in the shared substrate's gate wrapper
    // (`@stapel/tokens-antd/skin` GatedButton), stamped
    // `data-stapel-gated-reason` and linked to the button by
    // aria-describedby — not in a per-pair testid.
    const gate = await screen.findByTestId("forms-submit-gate");
    const blocked = gate.querySelector("[data-stapel-gated-reason]");
    // The sentence names the kind — a grey button with no reason is the
    // defect core's ActionAvailability exists to prevent.
    expect(blocked?.textContent).toContain("signature");
    expect(gate.getAttribute("data-stapel-gated")).toBe("blocked");
    expect(
      screen.getByTestId("forms-submit").getAttribute("aria-describedby")
    ).toBe(blocked?.id);
    expect(screen.getByTestId("forms-submit").getAttribute("aria-disabled")).toBe(
      "true"
    );
    // NOT html-disabled: a submit that fires nothing cannot say why it will
    // not submit. The gate swallows the click instead.
    expect(screen.getByTestId("forms-submit").hasAttribute("disabled")).toBe(false);
  });
});

describe("each builtin widget renders its kind", () => {
  const CASES: readonly { kind: string; config?: Record<string, unknown> }[] = [
    { kind: "string" },
    { kind: "string", config: { multiline: true } },
    { kind: "int", config: { min: 1, max: 9 } },
    { kind: "float", config: { precision: 2 } },
    { kind: "bool" },
    { kind: "select", config: { options: ["a", "b"], maxSelected: 1 } },
    { kind: "select", config: { options: ["a", "b", "c", "d", "e", "f"] } },
    { kind: "date", config: { precision: "date" } },
    { kind: "date", config: { precision: "year" } },
    { kind: "header", config: { style: "l" } },
    { kind: "hex_color", config: { options: ["#fff"] } },
    { kind: "hierarchical_select", config: { options: [{ value: "a", label: "A" }] } },
    { kind: "convertible_unit", config: { unitType: "length", unit_m: "m", unit_i: "ft" } },
  ];

  it.each(CASES)("renders $kind without crashing", async ({ kind, config }) => {
    const server = mockServer({
      [`GET /public/${PUBLIC_ID}/`]: {
        body: publicForm({
          fields: [
            { slug: "f", kind, name: `A ${kind}`, ...(config ? { config } : {}) },
          ],
        }),
      },
    });
    render(
      <TestHarness server={server}>
        <StapelForm publicId={PUBLIC_ID} />
      </TestHarness>
    );
    expect(await screen.findByTestId("forms-form")).toBeTruthy();
    expect(screen.queryByTestId("forms-unsupported-field")).toBeNull();
  });
});
