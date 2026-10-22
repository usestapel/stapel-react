/**
 * The field shape stapel-forms actually serves and stores: a `FeatureDef`
 * dict whose kind is `config.type`, with NO top-level `kind` key. Every
 * schema below is the server's verbatim shape — the other fixtures in this
 * folder carry a top-level `kind`, which the server never sends.
 */
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormBuilder, FormFill } from "../src/index.js";
import type { FormBuilderBag, FormFillBag, FormFieldDef } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import { FIELD_KINDS, FORM_ID, PUBLIC_ID, VERSION_ID, WORKSPACE_ID, formRow } from "./fixtures.js";

/** A five-question feedback form, exactly as `GET /public/<id>/` serves it. */
const WIRE_FIELDS = [
  { slug: "name", name: "Name", mandatory: true, config: { type: "string", maxLength: 200 } },
  { slug: "email", name: "Work email", mandatory: true, config: { type: "string", maxLength: 254 } },
  { slug: "company", name: "Company", mandatory: false, config: { type: "string", maxLength: 200 } },
  {
    slug: "role",
    name: "Your role",
    mandatory: false,
    config: { type: "select", options: ["Founder", "Engineer", "Other"], maxSelected: 1 },
  },
  {
    slug: "message",
    name: "Message",
    mandatory: true,
    config: { type: "string", multiline: true, maxLength: 5000 },
  },
] as unknown as readonly FormFieldDef[];

const WIRE_PUBLIC_FORM = {
  public_id: PUBLIC_ID,
  version_id: VERSION_ID,
  version: 4,
  meta: { title: "Write to us", submit_label: "Send" },
  fields: WIRE_FIELDS,
};

function renderFill(routes: Parameters<typeof mockServer>[0]) {
  const server = mockServer(routes);
  let latest: FormFillBag | undefined;
  render(
    <TestHarness server={server}>
      <FormFill publicId={PUBLIC_ID} builtinKinds={["string", "select"]}>
        {(bag) => {
          latest = bag;
          return null;
        }}
      </FormFill>
    </TestHarness>
  );
  return {
    server,
    bag: (): FormFillBag => {
      if (latest === undefined) throw new Error("bag not rendered");
      return latest;
    },
  };
}

describe("a public schema in the server's own shape", () => {
  it("renders every field and leaves Send available", async () => {
    const { bag } = renderFill({ [`GET /public/${PUBLIC_ID}/`]: { body: WIRE_PUBLIC_FORM } });
    await waitFor(() => expect(bag().state.status).toBe("ready"));

    expect(bag().unsupportedKinds).toEqual([]);
    expect(bag().submit.available).toBe(true);
    const state = bag().state;
    const kinds = state.status === "ready" ? state.data.fields.map((f) => f.kind) : [];
    expect(kinds).toEqual(["string", "string", "string", "select", "string"]);
  });

  it("sends the answers", async () => {
    const { server, bag } = renderFill({
      [`GET /public/${PUBLIC_ID}/`]: { body: WIRE_PUBLIC_FORM },
      [`POST /public/${PUBLIC_ID}/submissions/`]: {
        status: 201,
        body: { accepted: true, confirmation: "Thanks" },
      },
    });
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    act(() => bag().setValue("name", "Ada"));
    act(() => bag().setValue("email", "ada@example.com"));
    act(() => bag().setValue("role", "Engineer"));
    act(() => bag().setValue("message", "Hello"));
    // The button a skin draws reads this; on the old reader it was blocked.
    expect(bag().submit.available).toBe(true);
    act(() => bag().doSubmit());
    await waitFor(() => expect(bag().submitted).not.toBeNull());

    const post = server.calls.find((c) => c.method === "POST");
    const body = post?.body as { answers: Record<string, unknown>; version_id: string };
    expect(body.answers).toEqual({
      name: "Ada",
      email: "ada@example.com",
      role: "Engineer",
      message: "Hello",
    });
    expect(body.version_id).toBe(VERSION_ID);
  });
});

describe("the builder writes the server's shape", () => {
  it("reads config.type as the kind and saves config.type without a top-level kind", async () => {
    const server = mockServer({
      "GET /field-kinds": { body: FIELD_KINDS },
      [`GET /forms/${FORM_ID}`]: {
        body: formRow({ draft_schema: { fields: [WIRE_FIELDS[0]], meta: { title: "Write to us" } } }),
      },
      [`PUT /forms/${FORM_ID}/draft`]: { body: formRow() },
    });
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
    const bag = (): FormBuilderBag => {
      if (latest === undefined) throw new Error("bag not rendered");
      return latest;
    };
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    expect(bag().fields[0]?.field.kind).toBe("string");

    act(() => bag().addField("select"));
    await waitFor(() => expect(bag().save.available).toBe(true));
    act(() => bag().doSave());
    await waitFor(() => expect(server.calls.some((c) => c.method === "PUT")).toBe(true));

    const put = server.calls.find((c) => c.method === "PUT");
    const fields = (put?.body as { schema: { fields: Record<string, unknown>[] } }).schema.fields;
    expect(fields.map((f) => (f["config"] as { type?: string }).type)).toEqual(["string", "select"]);
    expect(fields.some((f) => "kind" in f)).toBe(false);
  });
});
