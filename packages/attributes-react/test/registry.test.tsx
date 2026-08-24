/**
 * The resolution ladder — the seam this package exists for.
 *
 *   explicit `registerValueEditor(type, …)`  > the skin's builtin >
 *   the loud `<UnsupportedValueEditor/>` + a submit blocked with a NAMED
 *   reason.
 *
 * The last rung is the one worth guarding: rendering nothing for a type this
 * build cannot draw would silently drop a feature that may be mandatory, and
 * the person would submit a listing they could not complete and be told, by
 * the server, that an attribute they never saw is missing.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import {
  UNTYPED_FEATURE,
  registerValueEditor,
  registeredValueEditorTypes,
  resolveValueEditor,
  unregisterValueEditor,
  unsupportedTypeGate,
  unsupportedTypes,
} from "../src/index.js";
import type { ValueEditorProps } from "../src/index.js";
import { registerAttributesI18n } from "../src/i18n/keys.js";
import { attributesI18nBundleRu } from "../src/i18n/ru.js";
import {
  BUILTIN_VALUE_EDITORS,
  BUILTIN_VALUE_EDITOR_TYPES,
} from "../src/default/editors.js";
import { FeatureFields } from "../src/default/FeatureFields.js";
import {
  ALL_BUILTIN_FEATURES,
  STRING_FEATURE,
  UNKNOWN_TYPE_FEATURE,
  UNTYPED_FEATURE_DEF,
} from "./fixtures.js";

afterEach(() => {
  cleanup();
  for (const type of registeredValueEditorTypes()) unregisterValueEditor(type);
});

function HostEditor(props: ValueEditorProps): ReactElement {
  return <input id={props.id} data-testid="host-editor" readOnly value="" />;
}

function wrap(node: ReactElement, locale = "en"): ReactElement {
  const i18n = createI18n({ locale });
  registerAttributesI18n(i18n);
  if (locale === "ru") i18n.registerBundle("ru", attributesI18nBundleRu);
  return <I18nProvider i18n={i18n}>{node}</I18nProvider>;
}

describe("rung 1 — an explicit registration", () => {
  it("starts empty and answers null for a type nobody registered", () => {
    expect(registeredValueEditorTypes()).toEqual([]);
    expect(resolveValueEditor("string")).toBeNull();
  });

  it("outranks the skin's builtin for a type the skin also draws", () => {
    registerValueEditor("string", HostEditor);
    render(
      wrap(
        <FeatureFields features={[STRING_FEATURE]} values={{}} onChange={() => {}} />
      )
    );
    expect(screen.getByTestId("host-editor")).toBeDefined();
  });

  it("unregistering restores the skin's builtin — the override is reversible", () => {
    registerValueEditor("string", HostEditor);
    expect(resolveValueEditor("string")).toBe(HostEditor);
    unregisterValueEditor("string");
    expect(resolveValueEditor("string")).toBeNull();
    render(
      wrap(
        <FeatureFields features={[STRING_FEATURE]} values={{}} onChange={() => {}} />
      )
    );
    expect(screen.queryByTestId("host-editor")).toBeNull();
    expect(screen.getByLabelText("title")).toBeDefined();
  });

  it("lists registered types sorted", () => {
    registerValueEditor("zeta", HostEditor);
    registerValueEditor("alpha", HostEditor);
    expect(registeredValueEditorTypes()).toEqual(["alpha", "zeta"]);
  });
});

describe("rung 2 — the skin's builtins", () => {
  it("covers exactly the ten types stapel-attributes ships", () => {
    expect(BUILTIN_VALUE_EDITOR_TYPES).toEqual([
      "bool",
      "convertible_unit",
      "date",
      "float",
      "header",
      "hex_color",
      "hierarchical_select",
      "int",
      "select",
      "string",
    ]);
    for (const type of BUILTIN_VALUE_EDITOR_TYPES) {
      expect(BUILTIN_VALUE_EDITORS[type]).toBeTypeOf("function");
    }
  });

  it("draws every builtin feature without reaching the notice", () => {
    render(
      wrap(
        <FeatureFields
          features={ALL_BUILTIN_FEATURES}
          values={{}}
          onChange={() => {}}
        />
      )
    );
    expect(screen.queryByTestId("attributes-unsupported-type")).toBeNull();
  });
});

describe("rung 3 — loud, and never a skipped field", () => {
  it("renders a NAMED notice for a type this build cannot draw", () => {
    render(
      wrap(
        <FeatureFields
          features={[UNKNOWN_TYPE_FEATURE]}
          values={{}}
          onChange={() => {}}
        />
      )
    );
    const notice = screen.getByTestId("attributes-unsupported-type");
    // The FEATURE is named; the type slug is not rendered at all (C-DEVCOPY —
    // `size_grid` is an identifier out of a Python registry, and a seller can
    // do nothing with it). Support reads it off the DOM instead.
    expect(notice.textContent).toContain("size grid"); // the feature's own name
    expect(notice.textContent).not.toContain("size_grid");
    expect(notice.getAttribute("data-attributes-type")).toBe("size_grid");
  });

  it("names the OTHER absence differently — a row with no type at all", () => {
    render(
      wrap(
        <FeatureFields
          features={[UNTYPED_FEATURE_DEF]}
          values={{}}
          onChange={() => {}}
        />
      )
    );
    const notice = screen.getByTestId("attributes-unsupported-type");
    expect(notice.textContent).toContain("misconfigured");
    expect(notice.getAttribute("data-attributes-type")).toBe("(none)");
  });

  it("says it in the viewer's language, not in English", () => {
    render(
      wrap(
        <FeatureFields
          features={[UNKNOWN_TYPE_FEATURE]}
          values={{}}
          onChange={() => {}}
        />,
        "ru"
      )
    );
    const notice = screen.getByTestId("attributes-unsupported-type");
    expect(notice.textContent).toContain("нельзя заполнить");
    expect(notice.getAttribute("data-attributes-type")).toBe("size_grid");
  });
});

describe("unsupportedTypes — the fact, without importing the skin", () => {
  it("reports nothing when every type resolves", () => {
    expect(unsupportedTypes(ALL_BUILTIN_FEATURES, BUILTIN_VALUE_EDITOR_TYPES)).toEqual([]);
  });

  it("reports an unknown type, sorted", () => {
    expect(
      unsupportedTypes(
        [STRING_FEATURE, UNKNOWN_TYPE_FEATURE, UNTYPED_FEATURE_DEF],
        BUILTIN_VALUE_EDITOR_TYPES
      )
    ).toEqual([UNTYPED_FEATURE, "size_grid"]);
  });

  it("stops reporting a type once a host registers an editor for it", () => {
    registerValueEditor("size_grid", HostEditor);
    expect(
      unsupportedTypes([UNKNOWN_TYPE_FEATURE], BUILTIN_VALUE_EDITOR_TYPES)
    ).toEqual([]);
  });

  it("reports every unknown type once, however many features carry it", () => {
    const twice = [UNKNOWN_TYPE_FEATURE, { ...UNKNOWN_TYPE_FEATURE, slug: "other" }];
    expect(unsupportedTypes(twice, BUILTIN_VALUE_EDITOR_TYPES)).toEqual(["size_grid"]);
  });
});

describe("unsupportedTypeGate — blocked WITH the reason named", () => {
  it("is available when everything draws", () => {
    const gate = unsupportedTypeGate(ALL_BUILTIN_FEATURES, BUILTIN_VALUE_EDITOR_TYPES);
    expect(gate.available).toBe(true);
  });

  it("blocks with a key and the offending FEATURES in its params — never a bare disabled", () => {
    const gate = unsupportedTypeGate(
      [STRING_FEATURE, UNKNOWN_TYPE_FEATURE],
      BUILTIN_VALUE_EDITOR_TYPES
    );
    expect(gate.available).toBe(false);
    expect(gate.block?.code).toBe("attributes.submit.blocked.unsupported_type");
    // FEATURE names, not type slugs: the reason is read by the person whose
    // submit is blocked. `unsupportedTypes` still carries the slug for a log.
    expect(gate.block?.params["features"]).toBe("size grid");
  });

  it("unblocks once the host registers the missing editor", () => {
    registerValueEditor("size_grid", HostEditor);
    expect(
      unsupportedTypeGate([UNKNOWN_TYPE_FEATURE], BUILTIN_VALUE_EDITOR_TYPES).available
    ).toBe(true);
  });
});
