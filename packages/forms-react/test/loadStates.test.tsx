/**
 * The LoadState law, asserted (spec §7.2): a failed schema fetch is NEVER
 * "no form here".
 *
 * These are the tests that would have caught the app.ironmemo.com incident
 * this fleet's `LoadState` exists because of — a 404'd read rendered as an
 * empty state. A form is worse: a blank page where a form should be looks
 * like a bad link, and the person leaves.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormFill } from "../src/index.js";
import { StapelForm } from "../src/default/index.js";
import { TestHarness, mockServer } from "./harness.js";
import { PUBLIC_ID, envelope, publicForm } from "./fixtures.js";

function renderForm(route: Parameters<typeof mockServer>[0]) {
  const server = mockServer(route);
  render(
    <TestHarness server={server}>
      <StapelForm publicId={PUBLIC_ID} />
    </TestHarness>
  );
  return server;
}

describe("<StapelForm> — the three outcomes of a schema fetch", () => {
  it("renders the form when the schema loads", async () => {
    renderForm({ [`/public/${PUBLIC_ID}/`]: { body: publicForm() } });
    expect(await screen.findByTestId("forms-form")).toBeTruthy();
    expect(screen.getByTestId("forms-submit")).toBeTruthy();
  });

  it("says the LINK is not valid on 404 — and shows no form", async () => {
    renderForm({
      [`/public/${PUBLIC_ID}/`]: {
        status: 404,
        body: envelope("error.404.forms_not_found"),
      },
    });
    expect(await screen.findByTestId("forms-not-found")).toBeTruthy();
    expect(screen.queryByTestId("forms-form")).toBeNull();
  });

  it("says the form is CLOSED on 410 — a different sentence from 404", async () => {
    renderForm({
      [`/public/${PUBLIC_ID}/`]: {
        status: 410,
        body: envelope("error.410.forms_closed"),
      },
    });
    expect(await screen.findByTestId("forms-closed")).toBeTruthy();
    expect(screen.queryByTestId("forms-not-found")).toBeNull();
    expect(screen.queryByTestId("forms-form")).toBeNull();
  });

  it("on a 5xx says WE could not load it, and offers a retry", async () => {
    renderForm({
      [`/public/${PUBLIC_ID}/`]: { status: 503, body: envelope("stapel.http.503") },
    });
    const alert = await screen.findByTestId("forms-load-failed");
    expect(alert).toBeTruthy();
    // The outage must not borrow either verdict's copy.
    expect(screen.queryByTestId("forms-not-found")).toBeNull();
    expect(screen.queryByTestId("forms-closed")).toBeNull();
    expect(screen.getByText("Try again")).toBeTruthy();
  });

  it("a network fault (no envelope at all) is still 'we could not ask'", async () => {
    const server = {
      calls: [],
      fetch: (() => Promise.reject(new Error("offline"))) as typeof globalThis.fetch,
    };
    render(
      <TestHarness server={server}>
        <StapelForm publicId={PUBLIC_ID} />
      </TestHarness>
    );
    expect(await screen.findByTestId("forms-load-failed")).toBeTruthy();
    expect(screen.queryByTestId("forms-not-found")).toBeNull();
  });
});

describe("<FormFill> — the bag never flattens the state", () => {
  it("exposes the discriminant, not a defaulted schema", async () => {
    const server = mockServer({
      [`/public/${PUBLIC_ID}/`]: {
        status: 404,
        body: envelope("error.404.forms_not_found"),
      },
    });
    const seen: string[] = [];
    render(
      <TestHarness server={server}>
        <FormFill publicId={PUBLIC_ID}>
          {(bag) => {
            seen.push(bag.state.status);
            return null;
          }}
        </FormFill>
      </TestHarness>
    );
    await waitFor(() => expect(seen).toContain("failed"));
    // There is no `ready` with empty fields anywhere in the sequence — the
    // failure cannot masquerade as a form with nothing in it.
    expect(seen).not.toContain("ready");
  });
});
