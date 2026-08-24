import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DsarQueue, OwnersHealth } from "../src/default/admin/index.js";
import { formatInstant } from "../src/index.js";
import { STAFF_ONLY, TestProviders, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import {
  DSAR_ACKNOWLEDGED,
  DSAR_ACK_OVERDUE,
  DSAR_RESOLVED,
  OWNER_ALIVE,
  OWNER_MISMATCHED,
  OWNER_SILENT,
} from "./fixtures.js";

const QUEUE = "GET /dsar";
const HEALTH = "/owners/health";

function mount(server: MockServer, ui: React.ReactElement): void {
  render(<TestProviders server={server}>{ui}</TestProviders>);
}

// ─────────────────────────────────────────────────────────────────────────────
// <DsarQueue>
// ─────────────────────────────────────────────────────────────────────────────

describe("<DsarQueue> — the staff refusal is named, not shown as a fault", () => {
  it("says 'this screen is for staff' instead of an operations-table error", async () => {
    const server = mockServer({ [QUEUE]: STAFF_ONLY });
    mount(server, <DsarQueue />);
    await waitFor(() =>
      expect(screen.getByTestId("gdpr-queue-staff-only")).toBeTruthy()
    );
    // Neither of the two wrong screens: a technical failure, or an empty
    // queue that would read as "no one has asked us anything".
    expect(screen.queryByTestId("gdpr-queue-failed")).toBeNull();
    expect(screen.queryByTestId("gdpr-queue-empty")).toBeNull();
  });

  it("any OTHER failure is still the ordinary error surface", async () => {
    const server = mockServer({
      [QUEUE]: { status: 500, body: { localizable_error: "error.500.internal" } },
    });
    mount(server, <DsarQueue />);
    await waitFor(() =>
      expect(screen.getByTestId("gdpr-queue-failed")).toBeTruthy()
    );
    expect(screen.queryByTestId("gdpr-queue-staff-only")).toBeNull();
  });

  it("an empty queue is a real answer, reachable only from a load that succeeded", async () => {
    const server = mockServer({ [QUEUE]: { body: [] } });
    mount(server, <DsarQueue />);
    await waitFor(() =>
      expect(screen.getByTestId("gdpr-queue-empty")).toBeTruthy()
    );
  });
});

describe("<DsarQueue> — an unacknowledged request past its clock means the automation broke", () => {
  it("flags the row overdue when nothing was ever sent", async () => {
    const server = mockServer({ [QUEUE]: { body: [DSAR_ACK_OVERDUE] } });
    mount(server, <DsarQueue />);
    const table = await screen.findByTestId("gdpr-queue-rows");
    expect(table.textContent).toContain("Overdue");
    // The banner too: the acknowledgement is automated, so this is a wiring
    // fault, not a slow operator.
    expect(screen.getByTestId("gdpr-queue-ack-overdue")).toBeTruthy();
  });

  it("shows the acknowledgement DATE instead, once it went out", async () => {
    const server = mockServer({ [QUEUE]: { body: [DSAR_ACKNOWLEDGED] } });
    mount(server, <DsarQueue />);
    const table = await screen.findByTestId("gdpr-queue-rows");
    expect(table.textContent).toContain(
      formatInstant(DSAR_ACKNOWLEDGED.ack_sent_at, "en")
    );
    expect(table.textContent).not.toContain("Not acknowledged");
    expect(screen.queryByTestId("gdpr-queue-ack-overdue")).toBeNull();
  });

  it("a RESOLVED request past its answer deadline is not overdue — it is done", async () => {
    const server = mockServer({ [QUEUE]: { body: [DSAR_RESOLVED] } });
    mount(server, <DsarQueue />);
    const table = await screen.findByTestId("gdpr-queue-rows");
    expect(table.textContent).toContain("Resolved");
    expect(table.textContent).not.toContain("Overdue");
    expect(screen.queryByTestId("gdpr-queue-ack-overdue")).toBeNull();
  });
});

describe("<DsarQueue> — triage writes through the module, by id", () => {
  it("moving a request's state PATCHes that request with the new state", async () => {
    const server = mockServer({
      "PATCH /dsar/": { body: { ...DSAR_ACKNOWLEDGED, state: "in_progress" } },
      [QUEUE]: { body: [DSAR_ACKNOWLEDGED] },
    });
    mount(server, <DsarQueue />);
    await screen.findByTestId("gdpr-queue-rows");

    // antd's Select is not a native <select>: open the listbox through the
    // role it exposes (class names moved between antd majors; the ARIA role
    // did not), then pick the option by its visible text.
    fireEvent.mouseDown(screen.getByRole("combobox"));
    const option = await screen.findByTitle("In progress");
    fireEvent.click(option);

    await waitFor(() =>
      expect(server.calls.some((call) => call.method === "PATCH")).toBe(true)
    );
    const patch = server.calls.find((call) => call.method === "PATCH");
    expect(patch?.url).toContain(`/dsar/${DSAR_ACKNOWLEDGED.request_id}`);
    expect(JSON.parse(patch?.body ?? "{}")).toEqual({ state: "in_progress" });
  });

  it("saving a note PATCHes the note and nothing else", async () => {
    const server = mockServer({
      "PATCH /dsar/": { body: { ...DSAR_ACKNOWLEDGED, note: "matched to account" } },
      [QUEUE]: { body: [DSAR_ACKNOWLEDGED] },
    });
    mount(server, <DsarQueue />);
    await screen.findByTestId("gdpr-queue-rows");

    fireEvent.change(screen.getByLabelText("Anything you want to add"), {
      target: { value: "matched to account" },
    });
    fireEvent.click(screen.getByText("Save note"));

    await waitFor(() =>
      expect(server.calls.some((call) => call.method === "PATCH")).toBe(true)
    );
    const patch = server.calls.find((call) => call.method === "PATCH");
    expect(JSON.parse(patch?.body ?? "{}")).toEqual({ note: "matched to account" });
  });

  it("will not PATCH a note that is byte-identical to the stored one", async () => {
    // `DSAR_RESOLVED.note` is "handled", so the draft starts EQUAL to the row.
    const server = mockServer({
      "PATCH /dsar/": { body: DSAR_RESOLVED },
      [QUEUE]: { body: [DSAR_RESOLVED] },
    });
    mount(server, <DsarQueue />);
    await screen.findByTestId("gdpr-queue-rows");

    const save = screen.getByText("Save note").closest("button");
    expect(save?.disabled).toBe(true);

    // Editing it and putting it back is still no change — a write that writes
    // nothing is an audit-trail entry for an edit that never happened.
    const input = screen.getByLabelText("Anything you want to add");
    fireEvent.change(input, { target: { value: "handled again" } });
    expect(screen.getByText("Save note").closest("button")?.disabled).toBe(false);
    fireEvent.change(input, { target: { value: "handled" } });
    expect(screen.getByText("Save note").closest("button")?.disabled).toBe(true);

    expect(server.calls.some((call) => call.method === "PATCH")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// <OwnersHealth> — silence is a row
// ─────────────────────────────────────────────────────────────────────────────

describe("<OwnersHealth> — a silent owner is a warning row, never an absent one", () => {
  it("keeps the silent system IN the table and counts it in the summary", async () => {
    const server = mockServer({
      [HEALTH]: { body: [OWNER_ALIVE, OWNER_SILENT, OWNER_MISMATCHED] },
    });
    mount(server, <OwnersHealth />);
    const table = await screen.findByTestId("gdpr-owners-rows");

    // The whole mechanism: the table is built from the INVENTORY, so the
    // system that answers nothing is the one you can see.
    expect(table.textContent).toContain("workspaces");
    expect(screen.getAllByTestId("gdpr-owners-silent-tag").length).toBe(1);

    const summary = screen.getByTestId("gdpr-owners-silent-summary");
    expect(summary.textContent).toContain("1");
    expect(summary.textContent).toContain("3");
  });

  it("'never answered' is a different finding from a stale timestamp", async () => {
    const server = mockServer({ [HEALTH]: { body: [OWNER_ALIVE, OWNER_SILENT] } });
    mount(server, <OwnersHealth />);
    const table = await screen.findByTestId("gdpr-owners-rows");
    expect(table.textContent).toContain("Never answered");
    expect(table.textContent).toContain(
      formatInstant(OWNER_ALIVE.last_alive_at, "en")
    );
  });

  it("no summary when every declared owner is answering", async () => {
    const server = mockServer({ [HEALTH]: { body: [OWNER_ALIVE] } });
    mount(server, <OwnersHealth />);
    await screen.findByTestId("gdpr-owners-rows");
    expect(screen.queryByTestId("gdpr-owners-silent-summary")).toBeNull();
    expect(screen.queryByTestId("gdpr-owners-silent-tag")).toBeNull();
  });
});

describe("<OwnersHealth> — the third state: alive, for the wrong subjects", () => {
  it("names both sets when an owner claims fewer subjects than it declares", async () => {
    const server = mockServer({ [HEALTH]: { body: [OWNER_MISMATCHED] } });
    mount(server, <OwnersHealth />);
    await screen.findByTestId("gdpr-owners-rows");
    const mismatch = screen.getByTestId("gdpr-owners-mismatch");
    expect(mismatch.textContent).toContain("meeting");
    // It is NOT silent — nothing alerts on it, which is exactly why the row
    // has to say something.
    expect(screen.queryByTestId("gdpr-owners-silent-tag")).toBeNull();
  });
});

describe("<OwnersHealth> — the emptiest table is the worst finding", () => {
  it("names an empty inventory instead of leaving a blank, healthy-looking card", async () => {
    const server = mockServer({ [HEALTH]: { body: [] } });
    mount(server, <OwnersHealth />);
    const empty = await screen.findByTestId("gdpr-owners-empty");
    expect(empty.textContent).toContain("nothing would receive an erasure");
  });

  it("the staff refusal is named here too", async () => {
    const server = mockServer({ [HEALTH]: STAFF_ONLY });
    mount(server, <OwnersHealth />);
    await waitFor(() =>
      expect(screen.getByTestId("gdpr-owners-staff-only")).toBeTruthy()
    );
    expect(screen.queryByTestId("gdpr-owners-failed")).toBeNull();
    expect(screen.queryByTestId("gdpr-owners-empty")).toBeNull();
  });
});
