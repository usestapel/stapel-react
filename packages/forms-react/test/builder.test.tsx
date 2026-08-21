/**
 * The builder: data-driven config forms, the §12 risk-5 builder-less rule,
 * the save-before-publish gate, and the config-key semantics the engine
 * depends on (absent ≠ null).
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormBuilder } from "../src/index.js";
import type { FormBuilderBag } from "../src/index.js";
import { FormBuilderPane } from "../src/default/index.js";
import { TestHarness, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import {
  FIELD_KINDS,
  FORM_ID,
  WORKSPACE_ID,
  envelope,
  formRow,
} from "./fixtures.js";

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

const KINDS_ROUTE = { "GET /field-kinds": { body: FIELD_KINDS } };
const ROUTES = {
  ...KINDS_ROUTE,
  [`GET /forms/${FORM_ID}`]: { body: formRow() },
};

describe("the builder reads the server's catalogue, not a mirrored table", () => {
  it("offers only kinds that are allowed AND registered AND declare a config form", async () => {
    const { bag } = renderBuilder(ROUTES);
    await waitFor(() => expect(bag().availableKinds.status).toBe("ready"));
    const offered =
      bag().availableKinds.status === "ready"
        ? (bag().availableKinds as { data: readonly { kind: string }[] }).data.map(
            (k) => k.kind
          )
        : [];
    // string/select/date qualify. convertible_unit declares no config form and
    // signature is not in the attributes registry, so neither is offered —
    // both are still renderable and still authorable via the draft PUT.
    expect(offered).toEqual(["string", "select", "date"]);
  });

  it("a catalogue that FAILED to load is not 'this deployment has no kinds'", async () => {
    const { bag } = renderBuilder({
      [`GET /forms/${FORM_ID}`]: { body: formRow() },
      "GET /field-kinds": { status: 503, body: envelope("stapel.http.503") },
    });
    await waitFor(() => expect(bag().availableKinds.status).toBe("failed"));
    // The distinction the whole LoadState discipline exists for, applied to
    // the builder's own dictionary.
    expect(bag().availableKinds.status).not.toBe("ready");
  });

  it("surfaces the config-widget vocabulary the server declares", async () => {
    const { bag } = renderBuilder(ROUTES);
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    await waitFor(() =>
      expect(Object.keys(bag().configWidgets)).toContain("max_selected_dropdown")
    );
    expect(bag().configWidgets["number"]).toEqual(["step"]);
  });

  it("passes config declarations through verbatim, params and all", async () => {
    const { bag } = renderBuilder(ROUTES);
    await waitFor(() => expect(bag().fields.length).toBeGreaterThan(0));
    const spec = bag().fields[0]?.configFields.find((f) => f.name === "maxLength");
    // `step` lives UNDER params — the real FormField.to_dict() shape, which
    // the deleted mirror had flattened.
    expect(spec?.kind).toBe("number");
    expect(spec?.params?.["step"]).toBe(1);
  });
});

describe("config defaults come from the served declaration", () => {
  it("writes ONLY the keys with a declared default — absent means engine default", async () => {
    const { bag } = renderBuilder(ROUTES);
    await waitFor(() => expect(bag().availableKinds.status).toBe("ready"));
    act(() => bag().addField("select"));
    await waitFor(() => expect(bag().fields).toHaveLength(2));
    // Writing `null` for an unset key would change behaviour: the engine reads
    // an absent key as "use my own default". maxSelected has no declared
    // default (absent = unlimited), so it must not be written.
    expect(bag().fields[1]?.field.config).toEqual({
      uiStyle: "dropdown",
      minSelected: 0,
    });
    expect("maxSelected" in (bag().fields[1]?.field.config ?? {})).toBe(false);
  });

  it("is empty for a kind that declares no config form", async () => {
    const { bag } = renderBuilder(ROUTES);
    await waitFor(() => expect(bag().availableKinds.status).toBe("ready"));
    act(() => bag().addField("convertible_unit"));
    await waitFor(() => expect(bag().fields).toHaveLength(2));
    expect(bag().fields[1]?.field.config).toBeUndefined();
  });
});

describe("the draft", () => {
  it("adds a field with a non-colliding slug and the kind's declared defaults", async () => {
    const { bag } = renderBuilder(ROUTES);
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    await waitFor(() => expect(bag().availableKinds.status).toBe("ready"));
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

  it("renders one add-button per offered kind, and none for the builder-less ones", async () => {
    const server = mockServer(ROUTES);
    render(
      <TestHarness server={server}>
        <FormBuilderPane workspaceId={WORKSPACE_ID} formId={FORM_ID} />
      </TestHarness>
    );
    await screen.findByTestId("forms-builder-add-string");
    expect(screen.getByTestId("forms-builder-add-select")).toBeTruthy();
    expect(screen.getByTestId("forms-builder-add-date")).toBeTruthy();
    expect(screen.queryByTestId("forms-builder-add-convertible_unit")).toBeNull();
    expect(screen.queryByTestId("forms-builder-add-signature")).toBeNull();
  });

  it("says the dictionary failed rather than showing zero buttons", async () => {
    const server = mockServer({
      [`GET /forms/${FORM_ID}`]: { body: formRow() },
      "GET /field-kinds": { status: 503, body: envelope("stapel.http.503") },
    });
    render(
      <TestHarness server={server}>
        <FormBuilderPane workspaceId={WORKSPACE_ID} formId={FORM_ID} />
      </TestHarness>
    );
    expect(await screen.findByTestId("forms-kinds-failed")).toBeTruthy();
    expect(screen.queryByTestId("forms-builder-add-string")).toBeNull();
  });
});
