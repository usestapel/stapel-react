/**
 * The two ends of DSA Art. 20: the person's panel, and the desk that answers.
 *
 * The interesting assertions are both refusals. On the desk, `same_actor` and
 * `appeal_resolved` share a screen and mean opposite things, and the one this
 * pair was SPECCED for (`400 invalid_outcome`) is not what the backend sends
 * any more — 0.3.0 made it a 409, and a console still reading the 400 would
 * tell somebody to fix an `outcome` field that was never wrong.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppealPanel } from "../src/default/index.js";
import { AppealsQueue } from "../src/default/admin/index.js";
import { TestProviders, envelope, mockServer } from "./harness.js";
import type { HandlerResult } from "./harness.js";
import { APPEAL_OPEN, APPEAL_UPHELD, CASE_QUEUED } from "../demo/_fixtures.js";

function desk(resolveAnswer: HandlerResult): ReturnType<typeof mockServer> {
  return mockServer({
    "POST /resolve": resolveAnswer,
    "/appeals/queue": { body: [APPEAL_OPEN] },
  });
}

describe("the appeal panel without a link explains instead of stalling", () => {
  it("says what an appeal needs, and does not draw a composer", async () => {
    render(
      <TestProviders server={mockServer({ "/appeals/": { body: [] } })}>
        <AppealPanel />
      </TestProviders>
    );
    const explained = await screen.findByTestId("moderation-appeal-need-link");
    expect(explained.textContent).toContain("notification");
    expect(screen.queryByTestId("moderation-appeal-body")).toBeNull();
  });

  it("with the link, the composer is gated until it says something", async () => {
    render(
      <TestProviders server={mockServer({ "/appeals/": { body: [] } })}>
        <AppealPanel caseId={CASE_QUEUED.id} />
      </TestProviders>
    );
    const gate = await screen.findByTestId("moderation-appeal-submit-gate");
    expect(gate.getAttribute("data-stapel-gated")).toBe("blocked");
    fireEvent.change(screen.getByTestId("moderation-appeal-body"), {
      target: { value: "That line was quoted from the buyer, not written by me." },
    });
    await waitFor(() =>
      expect(gate.getAttribute("data-stapel-gated")).toBe("available")
    );
  });

  it("names the 403 that means the decision was not about your content", async () => {
    const server = mockServer({
      "POST /appeals/": envelope(403, "error.403.moderation_not_appellant"),
      "/appeals/": { body: [] },
    });
    render(
      <TestProviders server={server}>
        <AppealPanel caseId={CASE_QUEUED.id} />
      </TestProviders>
    );
    await screen.findByTestId("moderation-appeal-body");
    fireEvent.change(screen.getByTestId("moderation-appeal-body"), {
      target: { value: "Please look again." },
    });
    await waitFor(() =>
      expect(
        screen
          .getByTestId("moderation-appeal-submit-gate")
          .getAttribute("data-stapel-gated")
      ).toBe("available")
    );
    fireEvent.click(screen.getByTestId("moderation-appeal-submit"));
    const refused = await screen.findByTestId("moderation-appeal-refused");
    expect(refused.textContent).toContain("not about your content");
  });
});

describe("the appeal desk tells its two refusals apart", () => {
  async function openSheetAndSubmit(): Promise<void> {
    await screen.findByTestId("moderation-appeals-rows");
    fireEvent.click(
      screen.getByTestId(`moderation-appeals-resolve-${APPEAL_OPEN.id}`)
    );
    await screen.findByTestId("moderation-appeals-outcome");
    fireEvent.click(
      document.body.querySelector('input[value="upheld"]') as HTMLElement
    );
    await waitFor(() =>
      expect(
        screen
          .getByTestId("moderation-appeals-submit-gate")
          .getAttribute("data-stapel-gated")
      ).toBe("available")
    );
    fireEvent.click(screen.getByTestId("moderation-appeals-submit"));
  }

  it("`same_actor` is not a fault: a colleague has to hear it", async () => {
    render(
      <TestProviders server={desk(envelope(403, "error.403.moderation_same_actor"))}>
        <AppealsQueue />
      </TestProviders>
    );
    await openSheetAndSubmit();
    const refused = await screen.findByTestId("moderation-appeals-refused");
    expect(refused.textContent).toContain("somebody else has to hear");
  });

  it("a decided appeal answers 409, and the sheet says exactly that", async () => {
    render(
      <TestProviders
        server={desk(envelope(409, "error.409.moderation_appeal_resolved"))}
      >
        <AppealsQueue />
      </TestProviders>
    );
    await openSheetAndSubmit();
    const refused = await screen.findByTestId("moderation-appeals-refused");
    expect(refused.textContent).toContain("already been decided");
  });

  it("a row that is already decided cannot be opened, and says why", async () => {
    render(
      <TestProviders
        server={mockServer({ "/appeals/queue": { body: [APPEAL_UPHELD] } })}
      >
        <AppealsQueue />
      </TestProviders>
    );
    await screen.findByTestId("moderation-appeals-rows");
    const gate = document.body.querySelector(
      `[data-testid="moderation-appeals-resolve-${APPEAL_UPHELD.id}-gate"]`
    );
    expect(gate?.getAttribute("data-stapel-gated")).toBe("blocked");
    expect(
      gate?.querySelector("[data-stapel-gated-reason]")?.textContent
    ).toContain("already been decided");
  });
});
