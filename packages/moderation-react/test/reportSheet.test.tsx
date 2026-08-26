/**
 * The complaint form's three interesting moments, all of them driven through
 * the real client and a real error envelope.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReportSheet } from "../src/default/index.js";
import { TestProviders, envelope, mockServer } from "./harness.js";
import { POLICY } from "../demo/_fixtures.js";

function gate(): HTMLElement {
  return screen.getByTestId("moderation-report-submit-gate");
}

function reason(): string {
  return (
    document.body.querySelector("[data-stapel-gated-reason]")?.textContent ?? ""
  );
}

describe("the submit gate says WHICH thing is missing", () => {
  it("walks reason → description → available", async () => {
    const server = mockServer({ "/policy": { body: POLICY } });
    render(
      <TestProviders server={server}>
        <ReportSheet open onClose={() => {}} targetType="listing" targetKey="8842" />
      </TestProviders>
    );

    await screen.findByTestId("moderation-report-reason-group");
    expect(gate().getAttribute("data-stapel-gated")).toBe("blocked");
    expect(reason()).toContain("Pick a reason");

    // `harassment` carries requires_description: the gate must move to the
    // NEXT missing thing rather than opening.
    fireEvent.click(
      document.body.querySelector('input[value="harassment"]') as HTMLElement
    );
    await waitFor(() => expect(reason()).toContain("explanation"));
    expect(gate().getAttribute("data-stapel-gated")).toBe("blocked");

    fireEvent.change(screen.getByTestId("moderation-report-description"), {
      target: { value: "They keep messaging me after I asked them to stop." },
    });
    await waitFor(() =>
      expect(gate().getAttribute("data-stapel-gated")).toBe("available")
    );
  });

  it("a reason with no description requirement opens the gate at once", async () => {
    const server = mockServer({ "/policy": { body: POLICY } });
    render(
      <TestProviders server={server}>
        <ReportSheet open onClose={() => {}} targetType="listing" targetKey="8842" />
      </TestProviders>
    );
    await screen.findByTestId("moderation-report-reason-group");
    fireEvent.click(
      document.body.querySelector('input[value="spam"]') as HTMLElement
    );
    await waitFor(() =>
      expect(gate().getAttribute("data-stapel-gated")).toBe("available")
    );
  });
});

describe("refusals are read by CODE and shown by name", () => {
  it("a 409 already-reported is a fact about the target, not a failure", async () => {
    const server = mockServer({
      "POST /reports/": envelope(409, "error.409.moderation_already_reported"),
      "/policy": { body: POLICY },
    });
    render(
      <TestProviders server={server}>
        <ReportSheet open onClose={() => {}} targetType="listing" targetKey="8842" />
      </TestProviders>
    );
    await screen.findByTestId("moderation-report-reason-group");
    fireEvent.click(
      document.body.querySelector('input[value="spam"]') as HTMLElement
    );
    await waitFor(() =>
      expect(gate().getAttribute("data-stapel-gated")).toBe("available")
    );
    fireEvent.click(screen.getByTestId("moderation-report-submit"));

    const alert = await screen.findByTestId("moderation-report-refused");
    // The pair's OWN sentence, not the backend's: the tail is what proves the
    // refusal was recognised by code rather than rendered through the generic
    // error dialect, whose text for this code says something similar.
    expect(alert.textContent).toContain("We are on it");
    // …and it OUTLIVES the request: the control stays shut with its own
    // sentence, rather than re-arming for a second identical 409.
    await waitFor(() =>
      expect(gate().getAttribute("data-stapel-gated")).toBe("blocked")
    );
    expect(reason()).toContain("already reported");
  });

  it("a stale reason refetches the policy and clears the dead selection", async () => {
    const server = mockServer({
      "POST /reports/": envelope(
        400,
        "error.400.moderation_reason_not_applicable"
      ),
      "/policy": { body: POLICY },
    });
    render(
      <TestProviders server={server}>
        <ReportSheet open onClose={() => {}} targetType="listing" targetKey="8842" />
      </TestProviders>
    );
    await screen.findByTestId("moderation-report-reason-group");
    const policyReadsBefore = server.calls.filter((call) =>
      call.url.includes("/policy")
    ).length;

    fireEvent.click(
      document.body.querySelector('input[value="spam"]') as HTMLElement
    );
    await waitFor(() =>
      expect(gate().getAttribute("data-stapel-gated")).toBe("available")
    );
    fireEvent.click(screen.getByTestId("moderation-report-submit"));

    const alert = await screen.findByTestId("moderation-report-refused");
    expect(alert.textContent).toContain("list has been refreshed");
    await waitFor(() =>
      expect(
        server.calls.filter((call) => call.url.includes("/policy")).length
      ).toBeGreaterThan(policyReadsBefore)
    );
    // Nothing is selected any more: the form was built from a policy that has
    // since changed, and the person is asked again rather than blamed.
    expect(
      (document.body.querySelector('input[value="spam"]') as HTMLInputElement)
        .checked
    ).toBe(false);
  });
});
