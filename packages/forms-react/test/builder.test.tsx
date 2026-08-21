/**
 * The builder: data-driven config forms, the §12 risk-5 builder-less rule,
 * the save-before-publish gate, and the config-key semantics the engine
 * depends on (absent ≠ null).
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  BUILDER_KINDS,
  FIELD_KIND_CONFIG_FORMS,
  FormBuilder,
  configFormFor,
  defaultConfigFor,
  isBuilderSupportedKind,
} from "../src/index.js";
import type { FormBuilderBag } from "../src/index.js";
import { FormBuilderPane } from "../src/default/index.js";
import { TestHarness, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { FORM_ID, WORKSPACE_ID, envelope, formRow } from "./fixtures.js";

function renderBuilder(routes: Parameters<typeof mockServer>[0]): {
  server: MockServer;
  bag: () => FormBuilderBag;
} {
  const server = mockServer(routes);
  let latest: FormBuilderBag | undefined;
  render(
    <TestHarness server={server}>
      <FormBuilder workspaceId={WORKSPACE_ID} formId={FORM_ID}>
        {(bag) => {
          latest = bag;
          return null;
        }}
      </FormBuilder>
    </TestHarness>
  );
  return {
    server,
    bag: () => {
      if (latest === undefined) throw new Error("bag not rendered");
      return latest;
    },
  };
}

const ROUTES = { [`GET /forms/${FORM_ID}`]: { body: formRow() } };

describe("the config-form table is a faithful mirror of config_form.py", () => {
  // Pinned against stapel_attributes/config_form.py::BUILTIN_FORMS. These
  // assertions are the drift gate for a table that cannot be generated,
  // because upstream serves the declarations onto a Django page and exposes
  // NO endpoint for them (see widgets/configForms.ts).
  it("declares a config form for the eight builder-supported kinds", () => {
    expect(Object.keys(FIELD_KIND_CONFIG_FORMS).sort()).toEqual([
      "bool",
      "date",
      "float",
      "header",
      "hex_color",
      "int",
      "select",
      "string",
    ]);
  });

  it("keeps hex_color's allowCustom default FALSE where int/float/string are TRUE (LN-B15)", () => {
    const find = (kind: string) =>
      configFormFor(kind)?.fields.find((f) => f.name === "allowCustom")?.default;
    expect(find("hex_color")).toBe(false);
    expect(find("int")).toBe(true);
    expect(find("float")).toBe(true);
    expect(find("string")).toBe(true);
  });

  it("preserves header.style's upstream default 'h2', which matches NO option (LN-B01)", () => {
    const style = configFormFor("header")?.fields[0];
    expect(style?.default).toBe("h2");
    expect(style?.options?.map((o) => o.value)).toEqual(["l", "m"]);
  });

  it("keeps select.uiStyle at the engine's dataclass default 'dropdown' (B2 canon)", () => {
    const uiStyle = configFormFor("select")?.fields.find(
      (f) => f.name === "uiStyle"
    );
    expect(uiStyle?.default).toBe("dropdown");
  });

  it("gives select.maxSelected NO default — absent means unlimited", () => {
    const maxSelected = configFormFor("select")?.fields.find(
      (f) => f.name === "maxSelected"
    );
    expect(maxSelected?.default).toBeUndefined();
  });

  it("marks date.options unsupported rather than hiding it", () => {
    const options = configFormFor("date")?.fields.find((f) => f.name === "options");
    expect(options?.kind).toBe("timestamp_array");
    expect(options?.unsupported).toBe(true);
  });

  it("carries string.multiline (stapel-attributes 0.4.6), defaulting to false", () => {
    const multiline = configFormFor("string")?.fields.find(
      (f) => f.name === "multiline"
    );
    expect(multiline?.kind).toBe("checkbox");
    expect(multiline?.default).toBe(false);
  });

  it("uses camelCase keys throughout — a snake_case typo is a cap that does not exist", () => {
    const names = Object.values(FIELD_KIND_CONFIG_FORMS).flatMap((form) =>
      form.fields.map((f) => f.name)
    );
    expect(names.filter((n) => n.includes("_"))).toEqual([]);
  });
});

describe("the §12 risk-5 builder-less rule", () => {
  it("ships convertible_unit and hierarchical_select builder-less", () => {
    // convertible_unit declares no config_form upstream at all;
    // hierarchical_select's only field is an unrepresentable tree editor.
    expect(isBuilderSupportedKind("convertible_unit")).toBe(false);
    expect(isBuilderSupportedKind("hierarchical_select")).toBe(false);
    expect(BUILDER_KINDS).not.toContain("convertible_unit");
    expect(BUILDER_KINDS).not.toContain("hierarchical_select");
  });

  it("still LISTS a builder-less field, flagged, instead of dropping it", async () => {
    const { bag } = renderBuilder({
      [`GET /forms/${FORM_ID}`]: {
        body: formRow({
          draft_schema: {
            fields: [{ slug: "len", kind: "convertible_unit", name: "Length" }],
            meta: {},
          },
        }),
      },
    });
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    expect(bag().fields).toHaveLength(1);
    expect(bag().fields[0]?.builderLess).toBe(true);
    expect(bag().fields[0]?.configForm).toBeUndefined();
  });

  it("names the config keys it cannot edit for a partially supported kind", async () => {
    const { bag } = renderBuilder({
      [`GET /forms/${FORM_ID}`]: {
        body: formRow({
          draft_schema: {
            fields: [{ slug: "d", kind: "date", name: "When" }],
            meta: {},
          },
        }),
      },
    });
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    expect(bag().fields[0]?.builderLess).toBe(false);
    expect(bag().fields[0]?.unsupportedConfigKeys).toEqual(["options"]);
  });
});

describe("config defaults", () => {
  it("writes ONLY the keys with a declared default — absent means engine default", () => {
    // Writing `null` for an unset key would change behaviour: the engine
    // reads an absent key as "use my own default".
    expect(defaultConfigFor("select")).toEqual({
      uiStyle: "dropdown",
      minSelected: 0,
    });
    expect("maxSelected" in defaultConfigFor("select")).toBe(false);
  });

  it("is empty for a builder-less kind", () => {
    expect(defaultConfigFor("convertible_unit")).toEqual({});
  });
});

describe("the draft", () => {
  it("adds a field with a non-colliding slug and the kind's declared defaults", async () => {
    const { bag } = renderBuilder(ROUTES);
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    act(() => bag().addField("select"));
    await waitFor(() => expect(bag().fields).toHaveLength(2));
    const added = bag().fields[1]?.field;
    expect(added?.slug).toBe("select_1");
    expect(added?.config).toEqual({ uiStyle: "dropdown", minSelected: 0 });
  });

  it("setFieldConfig(undefined) REMOVES a key rather than nulling it", async () => {
    const { bag } = renderBuilder(ROUTES);
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    act(() => bag().setFieldConfig("name", "maxLength", 5));
    await waitFor(() =>
      expect(bag().fields[0]?.field.config?.["maxLength"]).toBe(5)
    );
    act(() => bag().setFieldConfig("name", "maxLength", undefined));
    await waitFor(() =>
      expect("maxLength" in (bag().fields[0]?.field.config ?? {})).toBe(false)
    );
  });

  it("reorders by index — field order IS schema order", async () => {
    const { bag } = renderBuilder(ROUTES);
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    act(() => bag().addField("bool"));
    await waitFor(() => expect(bag().fields).toHaveLength(2));
    act(() => bag().moveField("bool_1", 0));
    await waitFor(() => expect(bag().fields[0]?.field.slug).toBe("bool_1"));
  });
});

describe("the save-before-publish gate", () => {
  it("blocks save while nothing has changed", async () => {
    const { bag } = renderBuilder(ROUTES);
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    expect(bag().isDirty).toBe(false);
    expect(bag().save.available).toBe(false);
    expect(bag().save.block?.code).toBe("forms.builder.blocked.no_changes");
  });

  it("blocks publish while the draft is unsaved, with the reason stated", async () => {
    const { bag } = renderBuilder(ROUTES);
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    act(() => bag().addField("bool"));
    await waitFor(() => expect(bag().isDirty).toBe(true));
    // Publishing now would release the PREVIOUSLY saved draft while the admin
    // looks at the new one.
    expect(bag().publish.available).toBe(false);
    expect(bag().publish.block?.code).toBe("forms.builder.blocked.unsaved_draft");
  });

  it("blocks publish on an empty schema", async () => {
    const { bag } = renderBuilder({
      [`GET /forms/${FORM_ID}`]: {
        body: formRow({ draft_schema: { fields: [], meta: {} } }),
      },
    });
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    expect(bag().publish.block?.code).toBe("forms.builder.blocked.empty_schema");
  });

  it("PUTs the whole draft envelope under `schema`", async () => {
    const { server, bag } = renderBuilder({
      ...ROUTES,
      [`PUT /forms/${FORM_ID}/draft`]: { body: formRow() },
    });
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    act(() => bag().setMeta({ title: "Renamed" }));
    await waitFor(() => expect(bag().save.available).toBe(true));
    act(() => bag().doSave());
    await waitFor(() =>
      expect(server.calls.some((c) => c.method === "PUT")).toBe(true)
    );
    const put = server.calls.find((c) => c.method === "PUT");
    const body = put?.body as { schema: { meta: { title: string } } };
    expect(body.schema.meta.title).toBe("Renamed");
  });
});

describe("publish refusals reach the surface", () => {
  it("keeps the server's params so the skin can name the offending key", async () => {
    const { bag } = renderBuilder({
      ...ROUTES,
      [`POST /forms/${FORM_ID}/publish`]: {
        status: 400,
        body: envelope("error.400.forms_invalid_schema", { key: "max_length" }),
      },
    });
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    act(() => bag().doPublish());
    await waitFor(() => expect(bag().error).not.toBeNull());
    expect(bag().error?.code).toBe("error.400.forms_invalid_schema");
    expect(bag().error?.params["key"]).toBe("max_length");
  });
});

describe("<FormBuilderPane> — the default skin", () => {
  it("never says 'no such form' when the read failed", async () => {
    const server = mockServer({
      [`GET /forms/${FORM_ID}`]: { status: 503, body: envelope("stapel.http.503") },
    });
    render(
      <TestHarness server={server}>
        <FormBuilderPane workspaceId={WORKSPACE_ID} formId={FORM_ID} />
      </TestHarness>
    );
    expect(await screen.findByTestId("forms-builder-failed")).toBeTruthy();
  });

  it("renders one add-button per builder-supported kind, and none for the rest", async () => {
    const server = mockServer(ROUTES);
    render(
      <TestHarness server={server}>
        <FormBuilderPane workspaceId={WORKSPACE_ID} formId={FORM_ID} />
      </TestHarness>
    );
    await screen.findByTestId("forms-builder-add-string");
    for (const kind of BUILDER_KINDS) {
      expect(screen.getByTestId(`forms-builder-add-${kind}`)).toBeTruthy();
    }
    expect(screen.queryByTestId("forms-builder-add-convertible_unit")).toBeNull();
    expect(screen.queryByTestId("forms-builder-add-hierarchical_select")).toBeNull();
  });
});
