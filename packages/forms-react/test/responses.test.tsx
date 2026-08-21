/**
 * Response review: per-version columns, keyset paging, resend (including the
 * REPLACE semantics of an override), and delete.
 */
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResponsesTable } from "../src/index.js";
import type { ResponsesTableBag } from "../src/index.js";
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

describe("delete", () => {
  it("closes the detail drawer for the row it erased", async () => {
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
