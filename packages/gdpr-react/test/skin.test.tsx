import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AccountClosurePanel,
  DataExportPanel,
  DsarForm,
  PendingDeletions,
} from "../src/default/index.js";
import { formatDeletionDate } from "../src/index.js";
import {
  CAPTCHA_INVALID,
  CLOSURE_ALREADY_PENDING,
  DOWNLOAD_CONSUMED,
  DOWNLOAD_EXPIRED,
  EXPORT_COOLDOWN,
  EXPORT_NOT_FOUND,
  LEGAL_HOLD,
  NO_ACTIVE_CLOSURE,
  TestProviders,
  mockServer,
} from "./harness.js";
import type { MockServer } from "./harness.js";
import {
  DELETING,
  DSAR_ACKNOWLEDGED,
  ERASURE_DONE,
  ERASURE_ERASING,
  ERASURE_TIMEOUT,
  EXPORT_ACCEPTED,
  EXPORT_PARTIAL,
  EXPORT_PENDING,
  EXPORT_PROCESSING,
  IN_GRACE,
} from "./fixtures.js";

const CLOSURE = "/user/account/close/status";
const CLOSE = "POST /user/account/close";
const EXPORT_STATUS = "/user/data-export/status";
const EXPORT_REQUEST = "POST /user/data-export/request";
const DOWNLOAD = "/user/data-export/download";

/** The date the panels actually print, computed with the same formatter the
 * skin uses — the invariant under test is that the SERVER's instant reaches
 * the screen as a date, not that this pair reimplements `Intl`. */
const asDate = (iso: string): string => formatDeletionDate(iso, "en");

function mount(
  server: MockServer,
  ui: React.ReactElement
): ReturnType<typeof render> {
  return render(<TestProviders server={server}>{ui}</TestProviders>);
}

/**
 * The viewport a dialog is about to be rendered into. jsdom's own window is
 * 1024x768, which is a desktop — so the phone case has to be ASKED for, before
 * the render, because `@stapel/tokens-antd/skin` reads the media query on its
 * very first client render (that is the point of it: no desktop modal flashing
 * on a phone for one frame).
 */
function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
}

/**
 * The reason text the substrate's `GatedControl` renders beside a blocked
 * control. Selected by the substrate's own attribute rather than by a test id
 * of ours: the contract is "a blocked control shows its reason, wired to
 * aria-describedby", and that attribute is where the contract lives.
 */
function gateReason(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-stapel-gated-reason]");
}

const JSDOM_DEFAULT_WIDTH = 1024;
afterEach(() => {
  setViewportWidth(JSDOM_DEFAULT_WIDTH);
});

// ─────────────────────────────────────────────────────────────────────────────
// <AccountClosurePanel> — the 404 that means "you are fine"
// ─────────────────────────────────────────────────────────────────────────────

describe("<AccountClosurePanel> — the 404 is an answer, not a failure", () => {
  it("renders 'not scheduled for deletion' and the door, never an error", async () => {
    const server = mockServer({ [CLOSURE]: NO_ACTIVE_CLOSURE });
    mount(server, <AccountClosurePanel />);
    await waitFor(() =>
      expect(screen.getByTestId("gdpr-closure-none")).toBeTruthy()
    );
    // The three things it must never be: an error, a blank card, or a banner
    // announcing a deletion nobody asked for.
    expect(screen.queryByTestId("gdpr-closure-failed")).toBeNull();
    expect(screen.queryByTestId("gdpr-closure-banner")).toBeNull();
    expect(screen.getByTestId("gdpr-closure-initiate")).toBeTruthy();
  });

  it("a genuine failure IS the failed arm — and says nothing about your account", async () => {
    const server = mockServer({
      [CLOSURE]: { status: 500, body: { localizable_error: "error.500.internal" } },
    });
    mount(server, <AccountClosurePanel />);
    await waitFor(() =>
      expect(screen.getByTestId("gdpr-closure-failed")).toBeTruthy()
    );
    expect(screen.queryByTestId("gdpr-closure-none")).toBeNull();
    expect(screen.queryByTestId("gdpr-closure-initiate")).toBeNull();
  });
});

describe("<AccountClosurePanel> — a scheduled closure shows a DATE and the way back", () => {
  it("names the day the account dies, formatted, never the raw instant", async () => {
    const server = mockServer({ [CLOSURE]: { body: IN_GRACE } });
    mount(server, <AccountClosurePanel />);
    const banner = await screen.findByTestId("gdpr-closure-banner");
    expect(banner.textContent).toContain(asDate(IN_GRACE.grace_ends_at));
    expect(banner.textContent).toContain("2026");
    expect(banner.textContent).not.toContain(IN_GRACE.grace_ends_at);
    expect(screen.getByTestId("gdpr-closure-cancel")).toBeTruthy();
  });

  it("stops offering a cancel once the erasure is running", async () => {
    const server = mockServer({ [CLOSURE]: { body: DELETING } });
    mount(server, <AccountClosurePanel />);
    await waitFor(() =>
      expect(screen.getByTestId("gdpr-closure-banner")).toBeTruthy()
    );
    expect(screen.queryByTestId("gdpr-closure-cancel")).toBeNull();
    expect(screen.getByTestId("gdpr-closure-final").textContent).toContain(
      "no longer be cancelled"
    );
  });

  it("cancelling issues the cancel call and returns to the idle state", async () => {
    // Stateful on purpose: after a cancel the module EXCLUDES cancelled rows
    // from the status read, so the next GET is the 404 again. A fixture that
    // kept answering `grace` would be asserting against a server that cannot
    // exist.
    let cancelled = false;
    const server = mockServer({
      "POST /user/account/cancel-close": () => {
        cancelled = true;
        return { body: { ...IN_GRACE, status: "cancelled", can_cancel: false } };
      },
      [CLOSURE]: () => (cancelled ? NO_ACTIVE_CLOSURE : { body: IN_GRACE }),
    });
    mount(server, <AccountClosurePanel />);
    fireEvent.click(await screen.findByTestId("gdpr-closure-cancel"));
    await waitFor(() =>
      expect(screen.getByTestId("gdpr-closure-none")).toBeTruthy()
    );
    expect(
      server.calls.some(
        (call) => call.method === "POST" && call.url.includes("cancel-close")
      )
    ).toBe(true);
  });
});

describe("<AccountClosurePanel> — the destructive step is behind a confirmation", () => {
  it("the button opens a dialog; the DIALOG's ok is what closes the account", async () => {
    const server = mockServer({
      [CLOSE]: { status: 202, body: IN_GRACE },
      [CLOSURE]: NO_ACTIVE_CLOSURE,
    });
    mount(server, <AccountClosurePanel />);
    fireEvent.click(await screen.findByTestId("gdpr-closure-initiate"));

    // Opening the dialog must not have written anything.
    expect(
      server.calls.filter((call) => call.method === "POST").length
    ).toBe(0);

    fireEvent.click(await screen.findByText("Yes, start deletion"));
    await waitFor(() =>
      expect(
        server.calls.some(
          (call) =>
            call.method === "POST" && call.url.endsWith("/user/account/close")
        )
      ).toBe(true)
    );
  });

  it("a legal hold is explained on its own terms, not as a generic failure", async () => {
    const server = mockServer({ [CLOSE]: LEGAL_HOLD, [CLOSURE]: NO_ACTIVE_CLOSURE });
    mount(server, <AccountClosurePanel />);
    fireEvent.click(await screen.findByTestId("gdpr-closure-initiate"));
    fireEvent.click(await screen.findByText("Yes, start deletion"));

    const hold = await screen.findByTestId("gdpr-closure-legal-hold");
    expect(hold.textContent).toContain("legal hold");
    expect(screen.queryByTestId("gdpr-closure-initiate-failed")).toBeNull();
  });

  it("'already pending' is absorbed: no alert of any kind, because it is not news", async () => {
    const server = mockServer({
      [CLOSE]: CLOSURE_ALREADY_PENDING,
      [CLOSURE]: NO_ACTIVE_CLOSURE,
    });
    mount(server, <AccountClosurePanel />);
    fireEvent.click(await screen.findByTestId("gdpr-closure-initiate"));
    fireEvent.click(await screen.findByText("Yes, start deletion"));

    await waitFor(() =>
      expect(
        server.calls.some((call) => call.url.endsWith("/user/account/close"))
      ).toBe(true)
    );
    expect(screen.queryByTestId("gdpr-closure-initiate-failed")).toBeNull();
    expect(screen.queryByTestId("gdpr-closure-legal-hold")).toBeNull();
  });
});

describe("<AccountClosurePanel> — the confirm obeys the design system's surface rule", () => {
  const openConfirm = async (): Promise<HTMLElement> => {
    const server = mockServer({
      [CLOSE]: { status: 202, body: IN_GRACE },
      [CLOSURE]: NO_ACTIVE_CLOSURE,
    });
    mount(server, <AccountClosurePanel />);
    fireEvent.click(await screen.findByTestId("gdpr-closure-initiate"));
    return screen.findByTestId("gdpr-closure-confirm");
  };

  it("is a BOTTOM SHEET on a phone", async () => {
    setViewportWidth(390);
    const dialog = await openConfirm();
    expect(dialog.getAttribute("data-stapel-dialog-surface")).toBe("sheet");
    // The sheet's dismissal is never gesture-only: the grab handle is a real
    // button carrying this pair's own close copy.
    expect(screen.getByTestId("stapel-sheet-handle").getAttribute("aria-label"))
      .toBe("Close");
  });

  it("is a centred MODAL on a desktop viewport", async () => {
    setViewportWidth(1024);
    const dialog = await openConfirm();
    expect(dialog.getAttribute("data-stapel-dialog-surface")).toBe("modal");
    expect(screen.queryByTestId("stapel-sheet-handle")).toBeNull();
  });

  it("commits the deletion from the sheet, same as from the modal", async () => {
    setViewportWidth(390);
    const server = mockServer({
      [CLOSE]: { status: 202, body: IN_GRACE },
      [CLOSURE]: NO_ACTIVE_CLOSURE,
    });
    mount(server, <AccountClosurePanel />);
    fireEvent.click(await screen.findByTestId("gdpr-closure-initiate"));
    fireEvent.click(await screen.findByTestId("gdpr-closure-confirm-ok"));
    await waitFor(() =>
      expect(
        server.calls.some(
          (call) =>
            call.method === "POST" && call.url.endsWith("/user/account/close")
        )
      ).toBe(true)
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// <PendingDeletions> — four screens, and two clocks
// ─────────────────────────────────────────────────────────────────────────────

describe("<PendingDeletions> — four arms, four different screens", () => {
  it("loading is not empty", () => {
    const server = mockServer({ "/me/erasures": { body: [] } });
    mount(server, <PendingDeletions />);
    expect(screen.getByTestId("gdpr-deletions-loading")).toBeTruthy();
    expect(screen.queryByTestId("gdpr-deletions-empty")).toBeNull();
    expect(screen.queryByTestId("gdpr-deletions-rows")).toBeNull();
  });

  it("a failed read is never 'nothing is being deleted'", async () => {
    const server = mockServer({
      "/me/erasures": { status: 500, body: { localizable_error: "error.500.internal" } },
    });
    mount(server, <PendingDeletions />);
    await waitFor(() =>
      expect(screen.getByTestId("gdpr-deletions-failed")).toBeTruthy()
    );
    expect(screen.queryByTestId("gdpr-deletions-empty")).toBeNull();
    expect(screen.queryByTestId("gdpr-deletions-rows")).toBeNull();
  });

  it("empty says so — and is reachable only from a load that succeeded", async () => {
    const server = mockServer({ "/me/erasures": { body: [] } });
    mount(server, <PendingDeletions />);
    await waitFor(() =>
      expect(screen.getByTestId("gdpr-deletions-empty").textContent).toContain(
        "Nothing of yours"
      )
    );
  });

  it("ready draws the row, resolved through the host's labelFor", async () => {
    const server = mockServer({ "/me/erasures": { body: [ERASURE_ERASING] } });
    render(
      <TestProviders server={server}>
        <PendingDeletions
          labelFor={(type, key) => (key === "9f1c2d3e" ? "Stand-up, 12 Aug" : key)}
        />
      </TestProviders>
    );
    const table = await screen.findByTestId("gdpr-deletions-rows");
    expect(table.textContent).toContain("Stand-up, 12 Aug");
    expect(table.textContent).toContain("Recording");
    expect(table.textContent).toContain("Being erased");
  });

  it("prints the raw subject key when the host resolves no label", async () => {
    const server = mockServer({ "/me/erasures": { body: [ERASURE_ERASING] } });
    mount(server, <PendingDeletions />);
    const table = await screen.findByTestId("gdpr-deletions-rows");
    // A list of what is being deleted must not silently drop a row it cannot
    // name: an ugly id beats a missing deletion.
    expect(table.textContent).toContain("9f1c2d3e");
  });
});

describe("<PendingDeletions> — two clocks, two columns", () => {
  it("renders due_at AND fully_erased_by, and they are different dates", async () => {
    const server = mockServer({ "/me/erasures": { body: [ERASURE_ERASING] } });
    mount(server, <PendingDeletions />);
    const table = await screen.findByTestId("gdpr-deletions-rows");

    const ours = asDate(ERASURE_ERASING.due_at);
    const everywhere = asDate(ERASURE_ERASING.fully_erased_by);
    // The fixture is built so the two genuinely differ — a component that drew
    // one column for both would pass a same-date fixture.
    expect(ours).not.toBe(everywhere);
    expect(table.textContent).toContain(ours);
    expect(table.textContent).toContain(everywhere);
  });

  it("labels the second clock as the one that includes processors", async () => {
    const server = mockServer({ "/me/erasures": { body: [ERASURE_DONE] } });
    mount(server, <PendingDeletions />);
    const table = await screen.findByTestId("gdpr-deletions-rows");
    expect(table.textContent).toContain("Erased from our systems by");
    expect(table.textContent).toContain("Erased everywhere by");
  });
});

describe("<PendingDeletions> — silence is surfaced", () => {
  it("a timeout row raises the banner instead of showing a quiet green tick", async () => {
    const server = mockServer({ "/me/erasures": { body: [ERASURE_TIMEOUT] } });
    mount(server, <PendingDeletions />);
    await waitFor(() =>
      expect(screen.getByTestId("gdpr-deletions-overdue")).toBeTruthy()
    );
    expect(screen.getByTestId("gdpr-deletions-rows").textContent).toContain(
      "Overdue"
    );
  });

  it("no banner when every request is on track", async () => {
    const server = mockServer({ "/me/erasures": { body: [ERASURE_ERASING] } });
    mount(server, <PendingDeletions />);
    await screen.findByTestId("gdpr-deletions-rows");
    expect(screen.queryByTestId("gdpr-deletions-overdue")).toBeNull();
  });
});

/**
 * The copy this screen exists to deliver has to be READ, and a phone has no
 * hover: what `timeout` means, which owners have not receipted, and what the
 * second date column is are all printed, not hidden behind a pointer.
 */
describe("<PendingDeletions> — the explanations are text, not tooltips", () => {
  it("says what an overdue row means — as text, and exactly once", async () => {
    const server = mockServer({
      // TWO overdue rows: the sentence is the same for both, and printing it
      // under each of them is the disabled-reason wall in another costume.
      "/me/erasures": {
        body: [ERASURE_TIMEOUT, { ...ERASURE_TIMEOUT, request_id: 19 }],
      },
    });
    const { container } = mount(server, <PendingDeletions />);
    await screen.findByTestId("gdpr-deletions-rows");
    const banner = screen.getByTestId("gdpr-deletions-overdue");
    expect(banner.textContent).toContain("has not confirmed");
    // Said once for the card, not once per row.
    const occurrences = (container.textContent ?? "").split(
      "has not confirmed"
    ).length - 1;
    expect(occurrences).toBe(1);
    // And it is TEXT: a phone has no hover, so nothing carries it as a title.
    expect(container.querySelector("[title*='has not confirmed']")).toBeNull();
    // The rows still NAME the state — the tag is per row, the essay is not.
    expect(screen.getAllByText("Overdue").length).toBeGreaterThanOrEqual(2);
  });

  it("names the owners a request is still waiting on", async () => {
    const server = mockServer({ "/me/erasures": { body: [ERASURE_ERASING] } });
    mount(server, <PendingDeletions />);
    const table = await screen.findByTestId("gdpr-deletions-rows");
    // Per-ROW copy stays in the row: which owners this particular request is
    // waiting on differs row by row, so it is not the banner's to say.
    expect(screen.queryByTestId("gdpr-deletions-overdue")).toBeNull();
    expect(table.textContent).toContain("media");
  });

  it("explains the second clock beside the table it labels", async () => {
    const server = mockServer({ "/me/erasures": { body: [ERASURE_ERASING] } });
    mount(server, <PendingDeletions />);
    const hint = await screen.findByTestId("gdpr-deletions-fully-erased-hint");
    expect(hint.textContent).toContain("contractual windows");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// <DataExportPanel>
// ─────────────────────────────────────────────────────────────────────────────

describe("<DataExportPanel> — the other 404 that is a state", () => {
  it("'you have not requested one' is not a failure", async () => {
    const server = mockServer({ [EXPORT_STATUS]: EXPORT_NOT_FOUND });
    mount(server, <DataExportPanel />);
    await waitFor(() =>
      expect(screen.getByTestId("gdpr-export-none")).toBeTruthy()
    );
    expect(screen.queryByTestId("gdpr-export-failed")).toBeNull();
    expect(screen.getByTestId("gdpr-export-request")).toBeTruthy();
  });
});

describe("<DataExportPanel> — the token is not ours to hold", () => {
  it("offers no download button without one, and says where the link is", async () => {
    const server = mockServer({ [EXPORT_STATUS]: { body: EXPORT_PARTIAL } });
    mount(server, <DataExportPanel />);
    await waitFor(() =>
      expect(screen.getByTestId("gdpr-export-token-hint")).toBeTruthy()
    );
    expect(screen.queryByTestId("gdpr-export-download")).toBeNull();
  });

  it("offers the download once the host passes the token from the email", async () => {
    const server = mockServer({ [EXPORT_STATUS]: { body: EXPORT_PARTIAL } });
    mount(server, <DataExportPanel token="tok-abc" />);
    await waitFor(() =>
      expect(screen.getByTestId("gdpr-export-download")).toBeTruthy()
    );
    expect(screen.queryByTestId("gdpr-export-token-hint")).toBeNull();
  });

  it("offers neither while the server says the archive is not downloadable", async () => {
    const server = mockServer({ [EXPORT_STATUS]: { body: EXPORT_PROCESSING } });
    mount(server, <DataExportPanel token="tok-abc" />);
    await waitFor(() =>
      expect(screen.getByTestId("gdpr-export-status")).toBeTruthy()
    );
    // `download_available` is the SERVER's bit; a panel deriving it from
    // `status` would offer a button that answers 410.
    expect(screen.queryByTestId("gdpr-export-download")).toBeNull();
    expect(screen.queryByTestId("gdpr-export-token-hint")).toBeNull();
  });
});

describe("<DataExportPanel> — a partial archive names its holes", () => {
  it("says which section could not be included", async () => {
    const server = mockServer({ [EXPORT_STATUS]: { body: EXPORT_PARTIAL } });
    mount(server, <DataExportPanel />);
    const partial = await screen.findByTestId("gdpr-export-partial");
    expect(partial.textContent).toContain("recordings");
  });
});

describe("<DataExportPanel> — the cooldown is a rule, not an error", () => {
  it("names the 30-day rule and stops offering the button", async () => {
    const server = mockServer({
      [EXPORT_REQUEST]: EXPORT_COOLDOWN,
      [EXPORT_STATUS]: EXPORT_NOT_FOUND,
    });
    mount(server, <DataExportPanel />);
    fireEvent.click(await screen.findByTestId("gdpr-export-request"));
    // The rule is not an error report: it is the REASON the button is off,
    // and it is rendered where the button is — by the substrate's gate, whose
    // reason node the control points `aria-describedby` at.
    await waitFor(() =>
      expect(
        screen
          .getByTestId("gdpr-export-request-gate")
          .getAttribute("data-stapel-gated")
      ).toBe("blocked")
    );
    const reason = gateReason();
    expect(reason?.textContent).toContain("once every 30 days");
    expect(
      screen
        .getByTestId("gdpr-export-request")
        .closest("button")
        ?.getAttribute("aria-describedby")
    ).toBe(reason?.getAttribute("id"));
    expect(screen.queryByTestId("gdpr-export-request-failed")).toBeNull();
  });

  it("an accepted request says the archive is being built", async () => {
    const server = mockServer({
      [EXPORT_REQUEST]: { status: 202, body: EXPORT_ACCEPTED },
      [EXPORT_STATUS]: EXPORT_NOT_FOUND,
    });
    mount(server, <DataExportPanel />);
    fireEvent.click(await screen.findByTestId("gdpr-export-request"));
    await waitFor(() =>
      expect(screen.getByTestId("gdpr-export-requested")).toBeTruthy()
    );
  });
});

describe("<DataExportPanel> — one archive at a time, refused BEFORE the request", () => {
  it.each([
    ["pending", EXPORT_PENDING],
    ["processing", EXPORT_PROCESSING],
  ])("cannot ask for a second archive while one is %s", async (_status, row) => {
    const server = mockServer({
      [EXPORT_REQUEST]: { status: 202, body: EXPORT_ACCEPTED },
      [EXPORT_STATUS]: { body: row },
    });
    mount(server, <DataExportPanel />);
    const button = await screen.findByTestId("gdpr-export-request");
    // The gate's own stamp, not html `disabled`: a blocked control is
    // `aria-disabled` and still alive, so `disabled` is permanently false and
    // a wait keyed on it would hang (or, waiting for false, return at once).
    await waitFor(() =>
      expect(
        screen.getByTestId("gdpr-export-request-gate").getAttribute("data-stapel-gated")
      ).toBe("blocked")
    );

    // …and the reason is READABLE, as text beside the control. A disabled
    // button receives no pointer events, so a tooltip here would be a reason
    // nobody can reach — least of all on the phone this rule exists for.
    const reason = gateReason();
    expect(reason?.textContent).toContain("already building");
    expect(button.closest("button")?.getAttribute("title")).toBeNull();

    fireEvent.click(button);
    expect(server.calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("offers the button again once the archive is finished", async () => {
    const server = mockServer({ [EXPORT_STATUS]: { body: EXPORT_PARTIAL } });
    mount(server, <DataExportPanel />);
    await screen.findByTestId("gdpr-export-status");
    expect(
      screen.getByTestId("gdpr-export-request-gate").getAttribute("data-stapel-gated")
    ).toBe("available");
    expect(gateReason()).toBeNull();
    expect(
      screen
        .getByTestId("gdpr-export-request-gate")
        .getAttribute("data-stapel-gated")
    ).toBe("available");
  });
});

describe("<DataExportPanel> — two 410s, two different screens", () => {
  it("a SPENT token says so", async () => {
    const server = mockServer({
      [DOWNLOAD]: DOWNLOAD_CONSUMED,
      [EXPORT_STATUS]: { body: EXPORT_PARTIAL },
    });
    mount(server, <DataExportPanel token="tok-abc" />);
    fireEvent.click(await screen.findByTestId("gdpr-export-download"));
    await waitFor(() =>
      expect(screen.getByTestId("gdpr-export-consumed")).toBeTruthy()
    );
    expect(screen.queryByTestId("gdpr-export-expired")).toBeNull();
  });

  it("an EXPIRED link is a different screen at the same status code", async () => {
    const server = mockServer({
      [DOWNLOAD]: DOWNLOAD_EXPIRED,
      [EXPORT_STATUS]: { body: EXPORT_PARTIAL },
    });
    mount(server, <DataExportPanel token="tok-abc" />);
    fireEvent.click(await screen.findByTestId("gdpr-export-download"));
    await waitFor(() =>
      expect(screen.getByTestId("gdpr-export-expired")).toBeTruthy()
    );
    expect(screen.queryByTestId("gdpr-export-consumed")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// <DsarForm>
// ─────────────────────────────────────────────────────────────────────────────

const bodyOf = (server: MockServer, needle: string): Record<string, unknown> => {
  const call = server.calls.find(
    (entry) => entry.method === "POST" && entry.url.includes(needle)
  );
  return JSON.parse(call?.body ?? "{}") as Record<string, unknown>;
};

describe("<DsarForm variant='app'> — the session already knows the address", () => {
  it("asks for no email at all", async () => {
    const server = mockServer({ "POST /dsar": { status: 201, body: DSAR_ACKNOWLEDGED } });
    mount(server, <DsarForm variant="app" />);
    await screen.findByTestId("gdpr-dsar-submit");
    expect(screen.queryByTestId("gdpr-dsar-email")).toBeNull();
  });

  it("sends kind and nothing that would let a caller redirect the answer", async () => {
    const server = mockServer({ "POST /dsar": { status: 201, body: DSAR_ACKNOWLEDGED } });
    mount(server, <DsarForm variant="app" />);
    fireEvent.click(await screen.findByTestId("gdpr-dsar-submit"));
    await waitFor(() => expect(server.calls.length).toBeGreaterThan(0));
    const body = bodyOf(server, "/dsar");
    expect(body["kind"]).toBe("access");
    expect(body).not.toHaveProperty("email");
  });
});

describe("<DsarForm variant='anonymous'> — the public form", () => {
  it("asks for an email, and refuses to send without one", async () => {
    const server = mockServer({ "POST /dsar": { status: 201, body: DSAR_ACKNOWLEDGED } });
    mount(server, <DsarForm variant="anonymous" />);
    expect(screen.getByTestId("gdpr-dsar-email")).toBeTruthy();

    fireEvent.click(screen.getByTestId("gdpr-dsar-submit"));
    expect(screen.getByTestId("gdpr-dsar-email-required")).toBeTruthy();
    // The refusal is local: nothing was sent, so no 400 had to explain it.
    expect(server.calls).toEqual([]);
  });

  it("carries the host's captcha token in the body", async () => {
    const server = mockServer({ "POST /dsar": { status: 201, body: DSAR_ACKNOWLEDGED } });
    mount(server, <DsarForm variant="anonymous" captchaToken="cap-123" />);
    fireEvent.change(screen.getByTestId("gdpr-dsar-email"), {
      target: { value: "person@example.com" },
    });
    fireEvent.click(screen.getByTestId("gdpr-dsar-submit"));
    await waitFor(() => expect(server.calls.length).toBeGreaterThan(0));

    const body = bodyOf(server, "/dsar");
    expect(body["email"]).toBe("person@example.com");
    expect(body["captcha_token"]).toBe("cap-123");
  });

  it("a rejected captcha is named, not shown as a generic failure", async () => {
    const server = mockServer({ "POST /dsar": CAPTCHA_INVALID });
    mount(server, <DsarForm variant="anonymous" />);
    fireEvent.change(screen.getByTestId("gdpr-dsar-email"), {
      target: { value: "person@example.com" },
    });
    fireEvent.click(screen.getByTestId("gdpr-dsar-submit"));
    await waitFor(() =>
      expect(screen.getByTestId("gdpr-dsar-captcha")).toBeTruthy()
    );
    expect(screen.queryByTestId("gdpr-dsar-failed")).toBeNull();
  });
});

describe("<DsarForm> — the acknowledgement is the thing you walk away with", () => {
  it("shows the reference number and BOTH statutory dates", async () => {
    const server = mockServer({ "POST /dsar": { status: 201, body: DSAR_ACKNOWLEDGED } });
    mount(server, <DsarForm variant="app" />);
    fireEvent.click(await screen.findByTestId("gdpr-dsar-submit"));

    const done = await screen.findByTestId("gdpr-dsar-submitted");
    expect(screen.getByTestId("gdpr-dsar-reference").textContent).toContain("5");
    expect(done.textContent).toContain(asDate(DSAR_ACKNOWLEDGED.ack_due_at));
    expect(done.textContent).toContain(asDate(DSAR_ACKNOWLEDGED.resolve_due_at));
    // A form that cleared itself would leave the person with nothing to quote.
    expect(screen.queryByTestId("gdpr-dsar-submit")).toBeNull();
  });
});
