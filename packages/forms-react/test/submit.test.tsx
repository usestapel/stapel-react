/**
 * The submit path: the client mirror, the server's per-field verdicts, the
 * 409 supersede handshake, and the captcha seam.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormFill } from "../src/index.js";
import type { FormFillBag } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import {
  NAME_FIELD,
  PUBLIC_ID,
  VERSION_ID,
  VERSION_ID_2,
  envelope,
  publicForm,
} from "./fixtures.js";

/** Render the headless bag and hand the test a live handle on it. */
function renderBag(routes: Parameters<typeof mockServer>[0]): {
  server: MockServer;
  bag: () => FormFillBag;
} {
  const server = mockServer(routes);
  let latest: FormFillBag | undefined;
  render(
    <TestHarness server={server}>
      <FormFill publicId={PUBLIC_ID} builtinKinds={["string", "select", "int"]}>
        {(bag) => {
          latest = bag;
          return <span data-testid="status">{bag.state.status}</span>;
        }}
      </FormFill>
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

const SCHEMA_ROUTE = { [`GET /public/${PUBLIC_ID}/`]: { body: publicForm() } };

async function ready(bag: () => FormFillBag): Promise<void> {
  await waitFor(() => expect(bag().state.status).toBe("ready"));
}

describe("the client mirror", () => {
  it("blocks a mandatory blank BEFORE any request leaves", async () => {
    const { server, bag } = renderBag(SCHEMA_ROUTE);
    await ready(bag);
    const before = server.calls.length;

    act(() => bag().doSubmit());

    await waitFor(() =>
      expect(bag().fieldErrors["name"]?.code).toBe(
        "error.400.feature_mandatory_missing"
      )
    );
    // Nothing was sent: the mirror is instant feedback, not a round trip.
    expect(server.calls.length).toBe(before);
  });

  it("raises the SERVER's own error key, so both halves read alike", async () => {
    const { bag } = renderBag(SCHEMA_ROUTE);
    await ready(bag);
    // maxLength is 10 on the fixture.
    act(() => bag().setValue("name", "a much longer name than allowed"));
    act(() => bag().doSubmit());
    await waitFor(() =>
      expect(bag().fieldErrors["name"]?.code).toBe(
        "error.400.feature_above_maximum"
      )
    );
    // `params.field` is what routes it onto a control — the fleet convention.
    expect(bag().fieldErrors["name"]?.params["field"]).toBe("name");
  });

  it("clears a field's error the moment it is edited", async () => {
    const { bag } = renderBag(SCHEMA_ROUTE);
    await ready(bag);
    act(() => bag().doSubmit());
    await waitFor(() => expect(bag().fieldErrors["name"]).toBeTruthy());
    act(() => bag().setValue("name", "Ada"));
    expect(bag().fieldErrors["name"]).toBeUndefined();
  });

  it("an optional blank is not an error, and is not sent", async () => {
    const { server, bag } = renderBag({
      ...SCHEMA_ROUTE,
      [`POST /public/${PUBLIC_ID}/submissions/`]: {
        status: 201,
        body: { accepted: true, confirmation: "ok" },
      },
    });
    await ready(bag);
    act(() => bag().setValue("name", "Ada"));
    act(() => bag().doSubmit());
    await waitFor(() => expect(bag().submitted).not.toBeNull());

    const post = server.calls.find((c) => c.method === "POST");
    const body = post?.body as { answers: Record<string, unknown> };
    expect(Object.keys(body.answers)).toEqual(["name"]);
    // `topic` and `budget` were left blank: omitted, not sent as empty.
    expect("topic" in body.answers).toBe(false);
  });
});

describe("the submit body", () => {
  it("echoes version_id so a racing publish is a clean 409", async () => {
    const { server, bag } = renderBag({
      ...SCHEMA_ROUTE,
      [`POST /public/${PUBLIC_ID}/submissions/`]: {
        status: 201,
        body: { accepted: true, confirmation: "ok" },
      },
    });
    await ready(bag);
    act(() => bag().setValue("name", "Ada"));
    act(() => bag().doSubmit());
    await waitFor(() => expect(bag().submitted).not.toBeNull());

    const post = server.calls.find((c) => c.method === "POST");
    expect((post?.body as { version_id: string }).version_id).toBe(VERSION_ID);
  });

  it("carries a captcha token when the seam was filled, and omits it otherwise", async () => {
    const { server, bag } = renderBag({
      ...SCHEMA_ROUTE,
      [`POST /public/${PUBLIC_ID}/submissions/`]: {
        status: 201,
        body: { accepted: true, confirmation: "ok" },
      },
    });
    await ready(bag);
    act(() => bag().setValue("name", "Ada"));
    act(() => bag().setCaptchaToken("tok-123"));
    act(() => bag().doSubmit());
    await waitFor(() => expect(bag().submitted).not.toBeNull());

    const post = server.calls.find((c) => c.method === "POST");
    expect((post?.body as { captcha_token?: string }).captcha_token).toBe("tok-123");
  });

  it("sends no captcha key at all when no token was set", async () => {
    const { server, bag } = renderBag({
      ...SCHEMA_ROUTE,
      [`POST /public/${PUBLIC_ID}/submissions/`]: {
        status: 201,
        body: { accepted: true, confirmation: "ok" },
      },
    });
    await ready(bag);
    act(() => bag().setValue("name", "Ada"));
    act(() => bag().doSubmit());
    await waitFor(() => expect(bag().submitted).not.toBeNull());
    const post = server.calls.find((c) => c.method === "POST");
    expect("captcha_token" in (post?.body as object)).toBe(false);
  });
});

describe("server refusals", () => {
  it("routes a per-field error.400.feature_* onto its slug via params.field", async () => {
    const { bag } = renderBag({
      ...SCHEMA_ROUTE,
      [`POST /public/${PUBLIC_ID}/submissions/`]: {
        status: 400,
        body: envelope("error.400.feature_invalid_format", {
          field: "name",
          slug: "name",
          feature: "Your name",
        }),
      },
    });
    await ready(bag);
    act(() => bag().setValue("name", "Ada"));
    act(() => bag().doSubmit());
    await waitFor(() =>
      expect(bag().fieldErrors["name"]?.code).toBe(
        "error.400.feature_invalid_format"
      )
    );
    // A per-field refusal is NOT a whole-form banner.
    expect(bag().formError).toBeNull();
  });

  it("lands EVERY entry of a multi-field params.fields[] refusal", async () => {
    const { bag } = renderBag({
      ...SCHEMA_ROUTE,
      [`POST /public/${PUBLIC_ID}/submissions/`]: {
        status: 400,
        body: envelope("error.400.feature_below_minimum", {
          field: "budget",
          fields: [
            {
              field: "budget",
              code: "error.400.feature_below_minimum",
              params: { field: "budget", min: 10 },
            },
            {
              field: "name",
              code: "error.400.feature_invalid_format",
              params: { field: "name" },
            },
          ],
        }),
      },
    });
    await ready(bag);
    act(() => bag().setValue("name", "Ada"));
    act(() => bag().setValue("budget", 50));
    act(() => bag().doSubmit());
    await waitFor(() => expect(bag().fieldErrors["budget"]).toBeTruthy());
    expect(bag().fieldErrors["name"]?.code).toBe(
      "error.400.feature_invalid_format"
    );
  });

  it("a whole-form refusal (410, 413, 429) becomes formError, not a field error", async () => {
    const { bag } = renderBag({
      ...SCHEMA_ROUTE,
      [`POST /public/${PUBLIC_ID}/submissions/`]: {
        status: 413,
        body: envelope("error.413.forms_body_too_large"),
      },
    });
    await ready(bag);
    act(() => bag().setValue("name", "Ada"));
    act(() => bag().doSubmit());
    await waitFor(() => expect(bag().formError).not.toBeNull());
    expect(bag().formError?.code).toBe("error.413.forms_body_too_large");
    expect(Object.keys(bag().fieldErrors)).toEqual([]);
  });
});

describe("409 forms_version_superseded", () => {
  it("refetches, keeps compatible answers, drops the rest, and says so", async () => {
    let schemaHits = 0;
    // The next version renames `topic` away and keeps `name` (same kind).
    const server = mockServer({
      [`GET /public/${PUBLIC_ID}/`]: () => {
        schemaHits += 1;
        return schemaHits === 1
          ? { body: publicForm() }
          : {
              body: publicForm({
                version_id: VERSION_ID_2,
                version: 4,
                fields: [NAME_FIELD],
              }),
            };
      },
      [`POST /public/${PUBLIC_ID}/submissions/`]: {
        status: 409,
        body: envelope("error.409.forms_version_superseded"),
      },
    });

    let latest: FormFillBag | undefined;
    render(
      <TestHarness server={server}>
        <FormFill publicId={PUBLIC_ID} builtinKinds={["string", "select", "int"]}>
          {(bag) => {
            latest = bag;
            return null;
          }}
        </FormFill>
      </TestHarness>
    );
    const bag = (): FormFillBag => {
      if (latest === undefined) throw new Error("bag not rendered");
      return latest;
    };

    await waitFor(() => expect(bag().state.status).toBe("ready"));
    act(() => bag().setValue("name", "Ada"));
    act(() => bag().setValue("topic", "Sales"));
    act(() => bag().doSubmit());

    await waitFor(() => expect(bag().superseded).toBe(true));
    await waitFor(() =>
      expect(
        bag().state.status === "ready" ? bag().state : undefined
      ).toBeTruthy()
    );
    await waitFor(() => expect(schemaHits).toBeGreaterThan(1));

    // `name` survives (same slug, same kind); `topic` is gone with its field.
    await waitFor(() => expect(bag().values["topic"]).toBeUndefined());
    expect(bag().values["name"]).toBe("Ada");
    // The captcha is spent — replaying it would fail on the server's terms.
    expect(bag().captchaToken).toBeNull();
  });

  // Explicit bound. This is the only test in the pair that mounts the WHOLE
  // skin, submits, takes a 409 and re-renders the refetched schema — three
  // full antd render passes under the shared `SkinTheme` ConfigProvider, which
  // regenerates its CSS-variable scope each time. It is genuinely slow in
  // jsdom (~20s on CI hardware) rather than hung: the banner appears, and the
  // assertion below is the proof. See SCRATCH/wave-b/REQUESTS-forms-react.md —
  // the cost is in the substrate's theme scope, not in this pair.
  it("surfaces the banner in the default skin so the person re-reads", async () => {
    // Drives the SKIN's own submit button — the banner lives in the
    // <FormFill> instance <StapelForm> owns, so a second, sibling FormFill
    // would have its own unrelated state.
    const server = mockServer({
      [`GET /public/${PUBLIC_ID}/`]: { body: publicForm() },
      [`POST /public/${PUBLIC_ID}/submissions/`]: {
        status: 409,
        body: envelope("error.409.forms_version_superseded"),
      },
    });
    const { StapelForm } = await import("../src/default/index.js");
    render(
      <TestHarness server={server}>
        <StapelForm publicId={PUBLIC_ID} />
      </TestHarness>
    );

    const input = await screen.findByLabelText("Your name");
    fireEvent.change(input, { target: { value: "Ada" } });
    fireEvent.click(screen.getByTestId("forms-submit"));

    expect(await screen.findByTestId("forms-superseded")).toBeTruthy();
  }, 60_000);
});

describe("the unsupported-kind guard", () => {
  it("blocks the submit and names the kind rather than skipping the field", async () => {
    const { bag } = renderBag({
      [`GET /public/${PUBLIC_ID}/`]: {
        body: publicForm({
          fields: [NAME_FIELD, { slug: "sig", kind: "signature", name: "Sign" }],
        }),
      },
    });
    await ready(bag);
    expect(bag().unsupportedKinds).toEqual(["signature"]);
    expect(bag().submit.available).toBe(false);
    expect(bag().submit.block?.code).toBe(
      "forms.submit.blocked.unsupported_kind"
    );
  });
});
