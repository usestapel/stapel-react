/**
 * `<FormSettingsPane>` / `<FormSettingsEditor>` — the surface that closes the
 * pair's defining gap.
 *
 * `PATCH /forms/<id>` is the ONLY writer of `Form.settings`, and
 * `Form.settings` is where a form's notification destinations and its
 * retention override live. Every assertion here is about one of the three
 * things that go wrong when a settings screen is written carelessly:
 *
 *  1. a wholesale `settings` replace that silently deletes a host's own keys;
 *  2. a client-side refusal of an address the server would have accepted;
 *  3. an empty configuration that LOOKS finished — the case where a form
 *     collects responses nobody is ever told about.
 */
import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormSettingsPane } from "../src/default/index.js";
import { FormSettingsEditor } from "../src/index.js";
import type { FormSettingsEditorBag } from "../src/index.js";
import { mockServer, TestHarness } from "./harness.js";
import type { MockServer } from "./harness.js";
import { FORM_ID, formRow, WORKSPACE_ID } from "./fixtures.js";

function renderPane(row: unknown, patchResult?: { status: number; body?: unknown }): {
  server: MockServer;
} {
  const server = mockServer({
    "PATCH /v1/forms/": patchResult ?? { body: row },
    "GET /v1/forms/": { body: row },
  });
  render(
    <TestHarness server={server} workspaceId={WORKSPACE_ID}>
      <FormSettingsPane formId={FORM_ID} />
    </TestHarness>
  );
  return { server };
}

/** The gate wrapper the substrate stamps around a blocked control. */
function saveReason(): string | undefined {
  const gate = screen.getByTestId("forms-settings-save-gate");
  return (
    gate.querySelector("[data-stapel-gated-reason]")?.textContent ?? undefined
  );
}

describe("the destinations a form notifies", () => {
  it("PATCHes the WHOLE settings bag, keeping keys this pair does not own", async () => {
    // A host put its own key in `settings`. `services.update_form` REPLACES
    // the bag, so a patch carrying only the three keys the pair drives would
    // delete it — silently, and only visible the next time the host looked.
    const row = formRow({
      settings: {
        notify_emails: ["sales@example.com"],
        host_owned_flag: "keep me",
      },
    });
    const { server } = renderPane(row);
    await screen.findByTestId("forms-settings-form");

    fireEvent.change(screen.getByTestId("forms-settings-title"), {
      target: { value: "Contact us — 2026" },
    });
    fireEvent.click(screen.getByTestId("forms-settings-save"));

    await waitFor(() => {
      expect(server.calls.some((c) => c.method === "PATCH")).toBe(true);
    });
    const patch = server.calls.find((c) => c.method === "PATCH");
    expect(patch?.body).toMatchObject({ title: "Contact us — 2026" });
    // Title-only edit: `settings` is not sent at all, so nothing can be lost.
    expect((patch?.body as Record<string, unknown>)["settings"]).toBeUndefined();
  });

  it("carries the host's unknown keys through when settings DO change", async () => {
    const row = formRow({
      settings: {
        notify_emails: ["sales@example.com"],
        host_owned_flag: "keep me",
      },
    });
    const { server } = renderPane(row);
    await screen.findByTestId("forms-settings-form");

    fireEvent.change(screen.getByTestId("forms-settings-retention"), {
      target: { value: "30" },
    });
    fireEvent.click(screen.getByTestId("forms-settings-save"));

    await waitFor(() => {
      expect(server.calls.some((c) => c.method === "PATCH")).toBe(true);
    });
    const settings = (
      server.calls.find((c) => c.method === "PATCH")?.body as {
        settings: Record<string, unknown>;
      }
    ).settings;
    expect(settings["host_owned_flag"]).toBe("keep me");
    expect(settings["retention_days"]).toBe(30);
    expect(settings["notify_emails"]).toEqual(["sales@example.com"]);
  });

  it("says out loud that an unconfigured form tells nobody", async () => {
    renderPane(formRow({ settings: {} }));
    await screen.findByTestId("forms-settings-form");
    expect(
      screen.getByTestId("forms-settings-no-destination").textContent
    ).toContain("nobody will be notified");
  });

  it("drops the notice once a destination exists", async () => {
    renderPane(formRow({ settings: { notify_telegram_chat_ids: ["-1001"] } }));
    await screen.findByTestId("forms-settings-form");
    expect(screen.queryByTestId("forms-settings-no-destination")).toBeNull();
  });
});

describe("what is mirrored, and what is left to the server", () => {
  it("blocks a retention override the CLIENT can judge, with the reason", async () => {
    // Driven through the BAG, not the number input: antd's `InputNumber`
    // clamps to `min` before it calls back, so the input can never hand the
    // machine the value this gate exists for. The gate still has to hold —
    // a host rendering its own control reaches it directly.
    const server = mockServer({ "GET /v1/forms/": { body: formRow() } });
    let seen: FormSettingsEditorBag | undefined;
    render(
      <TestHarness server={server} workspaceId={WORKSPACE_ID}>
        <FormSettingsEditor workspaceId={WORKSPACE_ID} formId={FORM_ID}>
          {(bag) => {
            seen = bag;
            return null;
          }}
        </FormSettingsEditor>
      </TestHarness>
    );
    await waitFor(() => expect(seen?.state.status).toBe("ready"));
    act(() => seen?.setRetentionDays(0));
    await waitFor(() => {
      expect(seen?.save.available).toBe(false);
      expect(seen?.save.block?.code).toBe("forms.settings.blocked.retention");
    });
  });

  it("does NOT guess the retention ceiling — the server refuses, and we render it", async () => {
    // `STAPEL_FORMS["RETENTION_DAYS"]` is a deployment setting no client can
    // read, so a too-long override is the server's verdict, not ours.
    const row = formRow();
    const { server } = renderPane(row, {
      status: 400,
      body: {
        code: "error.400.forms_invalid_retention",
        detail: "The retention override may only shorten the module retention period",
        params: { limit: 365 },
      },
    });
    await screen.findByTestId("forms-settings-form");
    fireEvent.change(screen.getByTestId("forms-settings-retention"), {
      target: { value: "4000" },
    });
    // The client lets it through: it has no standing to refuse.
    await waitFor(() => expect(saveReason()).toBeUndefined());
    fireEvent.click(screen.getByTestId("forms-settings-save"));
    await screen.findByTestId("forms-settings-error");
    expect(server.calls.some((c) => c.method === "PATCH")).toBe(true);
  });

  it("warns about a malformed address WITHOUT refusing to save it", async () => {
    // The backend validates retention and passes the lists through, so a
    // client-side refusal here would be a verdict this pair cannot give.
    renderPane(formRow({ settings: { notify_emails: ["sales at example"] } }));
    await screen.findByTestId("forms-settings-form");
    expect(screen.getByTestId("forms-settings-suspect").textContent).toContain(
      "sales at example"
    );
    // Blocked only because nothing has changed yet — not because of the address.
    expect(saveReason()).toBe("Nothing has changed since the last save.");
  });
});

describe("the save gate", () => {
  it("names 'nothing changed' rather than greying the button out", async () => {
    renderPane(formRow());
    await screen.findByTestId("forms-settings-form");
    expect(saveReason()).toBe("Nothing has changed since the last save.");
    expect(
      screen.getByTestId("forms-settings-save").getAttribute("aria-disabled")
    ).toBe("true");
  });

  it("refuses a form with no name, and says which", async () => {
    renderPane(formRow());
    await screen.findByTestId("forms-settings-form");
    fireEvent.change(screen.getByTestId("forms-settings-title"), {
      target: { value: "   " },
    });
    await waitFor(() => {
      expect(saveReason()).toBe("Give the form a name first.");
    });
  });
});

describe("the workspace a routed screen acts in", () => {
  it("uses the RUNTIME's workspace when the screen is given none", async () => {
    const { server } = renderPane(formRow());
    await screen.findByTestId("forms-settings-form");
    expect(
      server.calls.some((c) => c.url.includes(`workspace_id=${WORKSPACE_ID}`))
    ).toBe(true);
  });

  it("says so instead of rendering an empty screen when nobody declared one", () => {
    const server = mockServer({});
    render(
      <TestHarness server={server}>
        <FormSettingsPane formId={FORM_ID} />
      </TestHarness>
    );
    expect(screen.getByTestId("forms-settings-no-workspace")).toBeTruthy();
    // And it asks the server nothing — a screen with no workspace has no read
    // it could honestly make.
    expect(server.calls).toHaveLength(0);
  });
});
