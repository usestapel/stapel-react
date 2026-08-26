/**
 * The console's gates. Every assertion here is about a control that is SHUT
 * and the sentence beside it, because that is the half a boolean `disabled`
 * throws away — and about the one write that asks twice.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CaseDetail, ModerationQueue } from "../src/default/admin/index.js";
import { TestProviders, envelope, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import {
  CASE_DETAIL,
  CASE_DETAIL_CLAIMED,
  POLICY,
  STATS,
} from "../demo/_fixtures.js";

const COLLEAGUE = CASE_DETAIL_CLAIMED.claimed_by ?? "";

function card(detail: unknown): MockServer {
  return mockServer({
    "POST /verdict": { status: 201, body: {} },
    "/cases/": { body: detail },
    "/policy": { body: POLICY },
  });
}

/** antd puts `data-testid` on the checkbox's own input in some versions and on
 * the wrapper in others; the test asks for the input either way. */
function checkboxInput(testId: string): HTMLElement {
  const node = document.body.querySelector(`[data-testid="${testId}"]`);
  if (node === null) throw new Error(`no element with data-testid ${testId}`);
  const input =
    node.tagName === "INPUT" ? node : node.querySelector("input[type=checkbox]");
  if (input === null) throw new Error(`no checkbox inside ${testId}`);
  return input as HTMLElement;
}

function gateOf(name: string): string | null {
  return (
    document.body
      .querySelector(`[data-testid="moderation-case-${name}-gate"]`)
      ?.getAttribute("data-stapel-gated") ?? null
  );
}

function reasonOf(name: string): string {
  return (
    document.body
      .querySelector(`[data-testid="moderation-case-${name}-gate"]`)
      ?.querySelector("[data-stapel-gated-reason]")?.textContent ?? ""
  );
}

describe("the lease decides which controls are live", () => {
  it("a colleague's lease shuts every write, each with its own sentence", async () => {
    render(
      <TestProviders server={card(CASE_DETAIL_CLAIMED)}>
        <CaseDetail open caseId={CASE_DETAIL_CLAIMED.id} onClose={() => {}} />
      </TestProviders>
    );
    await screen.findByTestId("moderation-case-actions");
    await waitFor(() => expect(gateOf("claim")).toBe("blocked"));
    expect(reasonOf("claim")).toContain("somebody else");
    expect(gateOf("release")).toBe("blocked");
    expect(reasonOf("release")).toContain("somebody else");
    expect(gateOf("verdict-submit")).toBe("blocked");
  });

  it("my own lease turns claim into extend and opens release", async () => {
    render(
      <TestProviders server={card(CASE_DETAIL_CLAIMED)}>
        <CaseDetail
          open
          caseId={CASE_DETAIL_CLAIMED.id}
          viewerId={COLLEAGUE}
          onClose={() => {}}
        />
      </TestProviders>
    );
    const claim = await screen.findByTestId("moderation-case-claim");
    expect(claim.textContent).toContain("Extend");
    await waitFor(() => expect(gateOf("release")).toBe("available"));
    // The only thing still missing is the decision itself.
    expect(gateOf("verdict-submit")).toBe("blocked");
    expect(reasonOf("verdict-submit")).toContain("decision");
  });

  it("an unclaimed case explains that the case must be taken first", async () => {
    render(
      <TestProviders server={card(CASE_DETAIL)}>
        <CaseDetail open caseId={CASE_DETAIL.id} onClose={() => {}} />
      </TestProviders>
    );
    await screen.findByTestId("moderation-case-actions");
    await waitFor(() => expect(gateOf("claim")).toBe("available"));
    expect(gateOf("release")).toBe("blocked");
    expect(reasonOf("release")).toContain("Take the case first");
  });
});

describe("a sanction is a second act and is treated as one", () => {
  it("cannot accompany a decision that the content is fine", async () => {
    render(
      <TestProviders server={card(CASE_DETAIL_CLAIMED)}>
        <CaseDetail
          open
          caseId={CASE_DETAIL_CLAIMED.id}
          viewerId={COLLEAGUE}
          onClose={() => {}}
        />
      </TestProviders>
    );
    await screen.findByTestId("moderation-case-decision");
    expect(gateOf("sanction")).toBe("blocked");
    expect(reasonOf("sanction")).toContain("breaks the rules");

    fireEvent.click(
      document.body.querySelector('input[value="rejected"]') as HTMLElement
    );
    await waitFor(() => expect(gateOf("sanction")).toBe("available"));
  });

  it("blocks the verdict until the sanction says WHAT it is", async () => {
    render(
      <TestProviders server={card(CASE_DETAIL_CLAIMED)}>
        <CaseDetail
          open
          caseId={CASE_DETAIL_CLAIMED.id}
          viewerId={COLLEAGUE}
          onClose={() => {}}
        />
      </TestProviders>
    );
    await screen.findByTestId("moderation-case-decision");
    fireEvent.click(
      document.body.querySelector('input[value="rejected"]') as HTMLElement
    );
    await waitFor(() => expect(gateOf("verdict-submit")).toBe("available"));

    fireEvent.click(checkboxInput("moderation-case-sanction-toggle"));
    await waitFor(() => expect(gateOf("verdict-submit")).toBe("blocked"));
    expect(reasonOf("verdict-submit")).toContain("what the sanction is");
  });

  it("asks again before a sanction reaches a person's account", async () => {
    const server = card(CASE_DETAIL_CLAIMED);
    render(
      <TestProviders server={server}>
        <CaseDetail
          open
          caseId={CASE_DETAIL_CLAIMED.id}
          viewerId={COLLEAGUE}
          onClose={() => {}}
        />
      </TestProviders>
    );
    await screen.findByTestId("moderation-case-decision");
    fireEvent.click(
      document.body.querySelector('input[value="rejected"]') as HTMLElement
    );
    fireEvent.click(checkboxInput("moderation-case-sanction-toggle"));
    await screen.findByTestId("moderation-case-sanction-fields");

    // antd's Select opens on mouseDown and renders its options in a portal.
    fireEvent.mouseDown(
      document.body.querySelector(
        '[data-testid="moderation-case-sanction-kind"] .ant-select-content'
      ) as HTMLElement
    );
    fireEvent.click(await screen.findByTitle("Posting restricted"));
    await waitFor(() => expect(gateOf("verdict-submit")).toBe("available"));

    fireEvent.click(screen.getByTestId("moderation-case-verdict-submit"));
    // Nothing is written yet: the second act is confirmed, and the confirm
    // button names what it does rather than saying "OK".
    expect(
      server.calls.some(
        (call) => call.method === "POST" && call.url.includes("/verdict")
      )
    ).toBe(false);
    fireEvent.click(await screen.findByTestId("stapel-confirm-ok"));
    await waitFor(() =>
      expect(
        server.calls.some(
          (call) => call.method === "POST" && call.url.includes("/verdict")
        )
      ).toBe(true)
    );
    const written = server.calls.find(
      (call) => call.method === "POST" && call.url.includes("/verdict")
    );
    expect(written?.body).toContain("posting_restricted");
  });

  it("a plain verdict is written on the first press — no confirmation", async () => {
    const server = card(CASE_DETAIL_CLAIMED);
    render(
      <TestProviders server={server}>
        <CaseDetail
          open
          caseId={CASE_DETAIL_CLAIMED.id}
          viewerId={COLLEAGUE}
          onClose={() => {}}
        />
      </TestProviders>
    );
    await screen.findByTestId("moderation-case-decision");
    fireEvent.click(
      document.body.querySelector('input[value="approved"]') as HTMLElement
    );
    await waitFor(() => expect(gateOf("verdict-submit")).toBe("available"));
    fireEvent.click(screen.getByTestId("moderation-case-verdict-submit"));
    await waitFor(() =>
      expect(
        server.calls.some(
          (call) => call.method === "POST" && call.url.includes("/verdict")
        )
      ).toBe(true)
    );
  });
});

describe("the queue names the refusal the nav axis cannot express", () => {
  it("a signed-in non-moderator is told so, not shown an operations error", async () => {
    const server = mockServer({
      "/policy": { body: POLICY },
      "/stats": envelope(403, "error.403.moderation_forbidden"),
      "/cases": envelope(403, "error.403.moderation_forbidden"),
    });
    render(
      <TestProviders server={server}>
        <ModerationQueue />
      </TestProviders>
    );
    const named = await screen.findByTestId("moderation-queue-staff-only");
    expect(named.textContent).toContain("for moderators");
    expect(screen.queryByTestId("moderation-queue-failed")).toBeNull();
  });

  it("an empty queue is the good empty, and says which", async () => {
    const server = mockServer({
      "/policy": { body: POLICY },
      "/stats": { body: { ...STATS, open_total: 0 } },
      "/cases": { body: [] },
    });
    render(
      <TestProviders server={server}>
        <ModerationQueue />
      </TestProviders>
    );
    const empty = await screen.findByTestId("moderation-queue-empty");
    expect(empty.textContent).toContain("queue is clear");
  });
});
