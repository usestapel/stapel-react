/**
 * Response review: per-version columns, keyset paging, resend (including the
 * REPLACE semantics of an override), delete, and the default skin's detail
 * surface — which shape it takes on which viewport, and what it refuses to
 * offer on a row that was already erased.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ResponsesTable } from "../src/index.js";
import type { ResponsesTableBag } from "../src/index.js";
import { ResponsesPane } from "../src/default/index.js";
import { TestHarness, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { FORM_ID, SUBMISSIONS, VERSIONS, WORKSPACE_ID } from "./fixtures.js";

function renderTable(
  routes: Parameters<typeof mockServer>[0],
  limit = 50
): { server: MockServer; bag: () => ResponsesTableBag } {
  const server = mockServer(routes);
  let latest: ResponsesTableBag | undefined;
  render(
    <TestHarness server={server}>
      <ResponsesTable workspaceId={WORKSPACE_ID} formId={FORM_ID} limit={limit}>
        {(bag) => {
          latest = bag;
          return null;
        }}
      </ResponsesTable>
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

const BASE_ROUTES = {
  "GET /versions": { body: VERSIONS },
  "GET /submissions": { body: SUBMISSIONS },
};

describe("per-version columns", () => {
  it("with no filter, unions every version's fields, newest version first", async () => {
    const { bag } = renderTable(BASE_ROUTES);
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    const view = bag().state.status === "ready" ? bag().state : undefined;
    const columns =
      view?.status === "ready" ? view.data.columns.map((c) => c.slug) : [];
    // v3 has name+topic, v2 has name only. Union, newest first, no duplicate.
    expect(columns).toEqual(["name", "topic"]);
  });

  it("with a version filter, shows only THAT version's questions", async () => {
    const { bag } = renderTable(BASE_ROUTES);
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    act(() => bag().setVersion(2));
    await waitFor(() => {
      const state = bag().state;
      expect(
        state.status === "ready" ? state.data.columns.map((c) => c.slug) : null
      ).toEqual(["name"]);
    });
  });

  it("a header field is never a column — it has no answer", async () => {
    const { bag } = renderTable({
      "GET /versions": {
        body: [
          {
            ...(VERSIONS[0] as object),
            schema: {
              fields: [
                { slug: "h", kind: "header", name: "Section" },
                { slug: "name", kind: "string", name: "Your name" },
              ],
              meta: {},
            },
          },
        ],
      },
      "GET /submissions": { body: SUBMISSIONS },
    });
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    const state = bag().state;
    expect(
      state.status === "ready" ? state.data.columns.map((c) => c.slug) : null
    ).toEqual(["name"]);
  });
});

describe("keyset paging", () => {
  it("uses the last row's submitted_at as the next page's cursor", async () => {
    // A full page (limit 2) so `next` is available.
    const { server, bag } = renderTable(BASE_ROUTES, 2);
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    expect(bag().nextPage.available).toBe(true);

    act(() => bag().goNextPage());
    await waitFor(() => expect(bag().pageIndex).toBe(1));

    await waitFor(() => {
      const last = server.calls.filter((c) => c.url.includes("/submissions")).at(-1);
      const before = new URL(last?.url ?? "https://x/").searchParams.get("before");
      // The SECOND fixture row is the oldest — that is the cursor.
      expect(before).toBe("2026-08-21T10:30:00+00:00");
    });
  });

  it("a SHORT page is the end of the list, and says why the button is off", async () => {
    const { bag } = renderTable(BASE_ROUTES, 50);
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    expect(bag().nextPage.available).toBe(false);
    expect(bag().nextPage.block?.code).toBe("forms.responses.blocked.at_end");
  });

  it("the first page cannot go back, with a stated reason", async () => {
    const { bag } = renderTable(BASE_ROUTES);
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    expect(bag().prevPage.available).toBe(false);
    expect(bag().prevPage.block?.code).toBe("forms.responses.blocked.at_start");
  });

  it("changing the version filter resets the keyset trail", async () => {
    const { bag } = renderTable(BASE_ROUTES, 2);
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    act(() => bag().goNextPage());
    await waitFor(() => expect(bag().pageIndex).toBe(1));
    act(() => bag().setVersion(3));
    // Cursors from the unfiltered list address rows this filter may exclude.
    expect(bag().pageIndex).toBe(0);
  });
});

describe("resend", () => {
  it("sends an EMPTY body when no override is given (the form's own targets)", async () => {
    const { server, bag } = renderTable({
      ...BASE_ROUTES,
      "POST /resend": { body: { sent: 2 } },
    });
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    act(() => bag().resend("11111111-1111-4111-8111-111111111111"));
    await waitFor(() => expect(bag().lastResendCount).toBe(2));

    const post = server.calls.find((c) => c.url.includes("/resend"));
    expect(post?.body).toEqual({});
  });

  it("carries an override that REPLACES the configured targets", async () => {
    const { server, bag } = renderTable({
      ...BASE_ROUTES,
      "POST /resend": { body: { sent: 1 } },
    });
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    act(() =>
      bag().resend("11111111-1111-4111-8111-111111111111", {
        recipients: ["legal@example.com"],
      })
    );
    await waitFor(() => expect(bag().lastResendCount).toBe(1));

    const post = server.calls.find((c) => c.url.includes("/resend"));
    // Backend delta note 7: given a list, the form's own targets are replaced.
    expect(post?.body).toEqual({ recipients: ["legal@example.com"] });
  });

  it("is workspace-scoped like every other admin call", async () => {
    const { server, bag } = renderTable({
      ...BASE_ROUTES,
      "POST /resend": { body: { sent: 1 } },
    });
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    act(() => bag().resend("11111111-1111-4111-8111-111111111111"));
    await waitFor(() =>
      expect(server.calls.some((c) => c.url.includes("/resend"))).toBe(true)
    );
    const post = server.calls.find((c) => c.url.includes("/resend"));
    expect(new URL(post?.url ?? "https://x/").searchParams.get("workspace_id")).toBe(
      WORKSPACE_ID
    );
  });
});

/** jsdom's own window, restored between the viewport-sensitive cases. */
const JSDOM_WIDTH = 1024;

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
}

/**
 * Render the SKIN over the same mocked HTTP the headless cases use, at a
 * chosen viewport width. The width is set BEFORE the render: the surface
 * decision is made on the first client paint, which is the whole point of the
 * skin reading `matchMedia` through `useSyncExternalStore`.
 */
function renderPane(
  routes: Parameters<typeof mockServer>[0],
  viewportWidth: number
): MockServer {
  setViewportWidth(viewportWidth);
  const server = mockServer(routes);
  render(
    <TestHarness server={server}>
      <ResponsesPane workspaceId={WORKSPACE_ID} formId={FORM_ID} />
    </TestHarness>
  );
  return server;
}

/** Open the detail surface by clicking the row whose `submitted_at` this is. */
async function openRow(submittedAt: string): Promise<HTMLElement> {
  const cell = await screen.findByText(submittedAt);
  fireEvent.click(cell);
  return screen.findByTestId("forms-responses-dialog");
}

describe("the detail surface obeys the fleet dialog rule", () => {
  afterEach(() => {
    setViewportWidth(JSDOM_WIDTH);
  });

  it("is a bottom SHEET on a phone", async () => {
    renderPane(BASE_ROUTES, 390);
    const dialog = await openRow("2026-08-21T11:00:00+00:00");
    expect(dialog.getAttribute("data-stapel-dialog-surface")).toBe("sheet");
    // The sheet's grab handle is a real button, so the gesture is never the
    // only way out — proving the skin's sheet, not a bottom-placed drawer.
    expect(screen.getByTestId("stapel-sheet-handle")).toBeDefined();
  });

  it("is a centred MODAL on a tablet-or-wider viewport", async () => {
    renderPane(BASE_ROUTES, 1024);
    const dialog = await openRow("2026-08-21T11:00:00+00:00");
    expect(dialog.getAttribute("data-stapel-dialog-surface")).toBe("modal");
  });
});

describe("an erased response", () => {
  const ERASED_AT = "2026-08-22T09:00:00+00:00";
  const ERASED_SUBMITTED_AT = "2026-08-20T08:15:00+00:00";
  const ERASED_ROUTES = {
    "GET /versions": { body: VERSIONS },
    "GET /submissions": {
      body: [
        {
          ...(SUBMISSIONS[0] as object),
          id: "33333333-3333-4333-8333-333333333333",
          // Erasure keeps the row so the counts stay truthful, and empties the
          // answers — which is exactly why there is nothing left to resend.
          answers: {},
          submitted_at: ERASED_SUBMITTED_AT,
          erased_at: ERASED_AT,
        },
      ],
    },
  };

  afterEach(() => {
    setViewportWidth(JSDOM_WIDTH);
  });

  it("offers neither a resend nor a live delete, and says why in text", async () => {
    renderPane(ERASED_ROUTES, JSDOM_WIDTH);
    await openRow(ERASED_SUBMITTED_AT);

    expect(screen.getByTestId("forms-resend")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("forms-delete")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("forms-resend-override")).toHaveProperty(
      "disabled",
      true
    );

    // The reason is READABLE, beside the controls — a disabled button gets no
    // pointer events, so a tooltip would be a reason nobody can reach. It is
    // the shared substrate that renders it (GatedButton), and it wires the
    // sentence to the button with aria-describedby.
    const gate = screen.getByTestId("forms-delete-gate");
    const reason = gate.querySelector("[data-stapel-gated-reason]");
    expect(reason?.textContent).toBe(
      "This response was erased, so it can no longer be resent or deleted."
    );
    expect(
      screen.getByTestId("forms-delete").getAttribute("aria-describedby")
    ).toBe(reason?.id);
  });

  it("does not even offer the delete CONFIRMATION", async () => {
    renderPane(ERASED_ROUTES, JSDOM_WIDTH);
    await openRow(ERASED_SUBMITTED_AT);
    fireEvent.click(screen.getByTestId("forms-delete"));
    // A confirm that can never be confirmed is chrome pretending the action
    // exists; the dead button opens nothing at all.
    expect(screen.queryByText("Delete this response permanently?")).toBeNull();
    expect(screen.queryByTestId("stapel-confirm-ok")).toBeNull();
  });

  it("leaves both writes live on a response that was NOT erased", async () => {
    renderPane(BASE_ROUTES, JSDOM_WIDTH);
    await openRow("2026-08-21T11:00:00+00:00");
    expect(screen.getByTestId("forms-resend")).toHaveProperty("disabled", false);
    expect(screen.getByTestId("forms-delete")).toHaveProperty("disabled", false);
    expect(
      screen
        .getByTestId("forms-delete-gate")
        .querySelector("[data-stapel-gated-reason]")
    ).toBeNull();
  });
});

describe("delete", () => {
  it("closes the detail dialog for the row it erased", async () => {
    const { bag } = renderTable({
      ...BASE_ROUTES,
      "DELETE /submissions/": { status: 204 },
    });
    await waitFor(() => expect(bag().state.status).toBe("ready"));
    const row = (SUBMISSIONS[0] as { id: string }).id;
    act(() => bag().select(SUBMISSIONS[0] as never));
    expect(bag().selected).not.toBeNull();
    act(() => bag().remove(row));
    await waitFor(() => expect(bag().selected).toBeNull());
  });
});
