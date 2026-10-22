/**
 * The guest report (stapel-moderation 0.8.4).
 *
 * Under `ALLOW_ANONYMOUS_REPORTS` a visitor may file, and owes a contact
 * address plus the captcha whenever the deployment configured core's
 * verifier. Without `allowGuest` the sheet keeps the sign-in door: the policy
 * read does not carry the switch, so the host states it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReportSheet } from "../src/default/index.js";
import { TestProviders, envelope, mockServer } from "./harness.js";
import { POLICY } from "../demo/_fixtures.js";
import type * as Core from "@stapel/core";

const session = vi.hoisted(() => ({ status: "unauthenticated" as string | null }));

vi.mock("@stapel/core", async (importOriginal) => {
  const actual = await importOriginal<typeof Core>();
  return { ...actual, useActiveSessionStatus: () => session.status };
});

beforeEach(() => {
  session.status = "unauthenticated";
});

function gate(): HTMLElement {
  return screen.getByTestId("moderation-report-submit-gate");
}

function reason(): string {
  return document.body.querySelector("[data-stapel-gated-reason]")?.textContent ?? "";
}

function sentBody(
  calls: readonly { readonly method: string; readonly body?: unknown }[]
): Record<string, unknown> {
  const posted = calls.find((call) => call.method === "POST");
  return JSON.parse(String(posted?.body ?? "{}")) as Record<string, unknown>;
}

async function pickSpam(): Promise<void> {
  await screen.findByTestId("moderation-report-reason-group");
  fireEvent.click(document.body.querySelector('input[value="spam"]') as HTMLElement);
}

describe("a visitor on a deployment that accepts guest reports", () => {
  it("is asked for a contact address, then sends it with the captcha token", async () => {
    const server = mockServer({
      "/policy": { body: POLICY },
      "POST /reports/": { status: 201, body: { case_ref: "MOD-1" } },
    });
    render(
      <TestProviders server={server}>
        <ReportSheet
          open
          onClose={() => {}}
          targetType="listing"
          targetKey="8842"
          allowGuest
          captchaToken="tok-1"
        />
      </TestProviders>
    );
    await pickSpam();
    expect(screen.queryByTestId("moderation-report-visitor")).toBeNull();
    await waitFor(() => expect(reason()).toContain("email address"));
    expect(gate().getAttribute("data-stapel-gated")).toBe("blocked");

    fireEvent.change(screen.getByTestId("moderation-report-contact-email"), {
      target: { value: " guest@example.com " },
    });
    await waitFor(() => expect(gate().getAttribute("data-stapel-gated")).toBe("available"));
    fireEvent.click(screen.getByTestId("moderation-report-submit"));

    await screen.findByTestId("moderation-report-accepted");
    const posted = sentBody(server.calls);
    expect(posted).toMatchObject({
      target_type: "listing",
      target_key: "8842",
      reason_code: "spam",
      contact_email: "guest@example.com",
      captcha_token: "tok-1",
    });
  });

  it("names a captcha refusal instead of a generic failure", async () => {
    const server = mockServer({
      "/policy": { body: POLICY },
      "POST /reports/": envelope(400, "error.400.captcha_invalid"),
    });
    render(
      <TestProviders server={server}>
        <ReportSheet open onClose={() => {}} targetType="listing" targetKey="8842" allowGuest />
      </TestProviders>
    );
    await pickSpam();
    fireEvent.change(screen.getByTestId("moderation-report-contact-email"), {
      target: { value: "guest@example.com" },
    });
    await waitFor(() => expect(gate().getAttribute("data-stapel-gated")).toBe("available"));
    fireEvent.click(screen.getByTestId("moderation-report-submit"));
    const alert = await screen.findByTestId("moderation-report-refused");
    expect(alert.textContent).toContain("Complete it again");
  });

  it("without allowGuest keeps the sign-in door and sends nothing", async () => {
    const server = mockServer({ "/policy": { body: POLICY } });
    render(
      <TestProviders server={server}>
        <ReportSheet open onClose={() => {}} targetType="listing" targetKey="8842" />
      </TestProviders>
    );
    await pickSpam();
    expect(screen.getByTestId("moderation-report-visitor")).toBeTruthy();
    expect(screen.queryByTestId("moderation-report-contact-email")).toBeNull();
    await waitFor(() => expect(reason()).toContain("Sign in"));
  });

  it("an account's report carries neither the contact nor the token", async () => {
    session.status = "authenticated";
    const server = mockServer({
      "/policy": { body: POLICY },
      "POST /reports/": { status: 201, body: { case_ref: "MOD-2" } },
    });
    render(
      <TestProviders server={server}>
        <ReportSheet
          open
          onClose={() => {}}
          targetType="listing"
          targetKey="8842"
          allowGuest
          captchaToken="tok-1"
        />
      </TestProviders>
    );
    await pickSpam();
    expect(screen.queryByTestId("moderation-report-contact-email")).toBeNull();
    await waitFor(() => expect(gate().getAttribute("data-stapel-gated")).toBe("available"));
    fireEvent.click(screen.getByTestId("moderation-report-submit"));
    await screen.findByTestId("moderation-report-accepted");
    const posted = sentBody(server.calls);
    expect(posted).toHaveProperty("reason_code", "spam");
    expect(posted).not.toHaveProperty("contact_email");
    expect(posted).not.toHaveProperty("captcha_token");
  });
});
