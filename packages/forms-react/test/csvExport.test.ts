/**
 * The CSV export: the `X-Forms-Next-Before` header cursor, verbatim
 * round-tripping, and the header-row-once concatenation.
 *
 * The cursor is the whole reason this path exists outside core's JSON client
 * — it rides a RESPONSE HEADER, which `StapelClient.request` does not surface
 * at all, and the body is a spreadsheet rather than JSON.
 */
import { describe, expect, it } from "vitest";
import {
  FORMS_NEXT_BEFORE_HEADER,
  concatCsvPages,
  createFormsApi,
  exportSubmissionsCsv,
} from "../src/index.js";
import { createStapelClient } from "@stapel/core";
import { mockServer } from "./harness.js";
import { FORM_ID, WORKSPACE_ID, envelope } from "./fixtures.js";

const BASE = "https://forms.test/forms/api/v1";

// The Z-suffixed cursor of backend delta note 6. A bare `+00:00` in a query
// string decodes to a SPACE, which made the second page a silent 400 during
// the backend build — so the pair must pass this back byte for byte.
const CURSOR = "2026-08-21T10:30:00Z";

function api(routes: Parameters<typeof mockServer>[0]) {
  const server = mockServer(routes);
  const client = createStapelClient({ baseUrl: BASE, fetch: server.fetch });
  return { server, api: createFormsApi(client, { fetch: server.fetch }) };
}

describe("one export page", () => {
  it("returns the CSV text and the cursor from the response header", async () => {
    const { api: forms } = api({
      "/submissions/export": {
        text: "name,topic\nAda,Sales\n",
        headers: { [FORMS_NEXT_BEFORE_HEADER]: CURSOR },
      },
    });
    const page = await forms.exportSubmissions({
      workspaceId: WORKSPACE_ID,
      formId: FORM_ID,
    });
    expect(page.csv).toBe("name,topic\nAda,Sales\n");
    expect(page.nextBefore).toBe(CURSOR);
  });

  it("treats an ABSENT header as the last page", async () => {
    const { api: forms } = api({
      "/submissions/export": { text: "name\nAda\n" },
    });
    const page = await forms.exportSubmissions({
      workspaceId: WORKSPACE_ID,
      formId: FORM_ID,
    });
    expect(page.nextBefore).toBeNull();
  });

  it("treats an EMPTY header as the last page, not as a cursor of ''", async () => {
    const { api: forms } = api({
      "/submissions/export": {
        text: "name\nAda\n",
        headers: { [FORMS_NEXT_BEFORE_HEADER]: "" },
      },
    });
    const page = await forms.exportSubmissions({
      workspaceId: WORKSPACE_ID,
      formId: FORM_ID,
    });
    expect(page.nextBefore).toBeNull();
  });

  it("sends the cursor back VERBATIM as ?before=", async () => {
    const { server, api: forms } = api({
      "/submissions/export": { text: "name\n" },
    });
    await forms.exportSubmissions({
      workspaceId: WORKSPACE_ID,
      formId: FORM_ID,
      before: CURSOR,
    });
    const url = server.calls[0]?.url ?? "";
    // Percent-encoded in transit, but decoding must yield the exact cursor —
    // no reformatting, no re-parsing into a Date and back.
    const before = new URL(url).searchParams.get("before");
    expect(before).toBe(CURSOR);
  });

  it("scopes the export to the workspace and honours a version filter", async () => {
    const { server, api: forms } = api({
      "/submissions/export": { text: "name\n" },
    });
    await forms.exportSubmissions({
      workspaceId: WORKSPACE_ID,
      formId: FORM_ID,
      version: 2,
    });
    const params = new URL(server.calls[0]?.url ?? "").searchParams;
    expect(params.get("workspace_id")).toBe(WORKSPACE_ID);
    expect(params.get("version")).toBe("2");
  });

  it("throws the stapel envelope on a refusal, like every other operation", async () => {
    const { api: forms } = api({
      "/submissions/export": {
        status: 403,
        body: envelope("error.403.forms_forbidden"),
      },
    });
    await expect(
      forms.exportSubmissions({ workspaceId: WORKSPACE_ID, formId: FORM_ID })
    ).rejects.toMatchObject({ code: "error.403.forms_forbidden", status: 403 });
  });
});

describe("driving the export to completion", () => {
  it("follows the header cursor across pages until it is absent", async () => {
    let page = 0;
    const server = mockServer({
      "/submissions/export": () => {
        page += 1;
        if (page === 1) {
          return {
            text: "name\nAda\n",
            headers: { [FORMS_NEXT_BEFORE_HEADER]: CURSOR },
          };
        }
        return { text: "name\nGrace\n" };
      },
    });
    const transport = { baseUrl: BASE, fetch: server.fetch };
    const first = await exportSubmissionsCsv(transport, {
      workspaceId: WORKSPACE_ID,
      formId: FORM_ID,
    });
    expect(first.nextBefore).not.toBeNull();
    const second = await exportSubmissionsCsv(transport, {
      workspaceId: WORKSPACE_ID,
      formId: FORM_ID,
      ...(first.nextBefore !== null ? { before: first.nextBefore } : {}),
    });
    expect(second.nextBefore).toBeNull();
    expect(concatCsvPages([first.csv, second.csv])).toBe("name\nAda\nGrace\n");
  });
});

describe("concatCsvPages", () => {
  it("keeps the header row exactly once", () => {
    expect(concatCsvPages(["a,b\n1,2\n", "a,b\n3,4\n"])).toBe("a,b\n1,2\n3,4\n");
  });

  it("newline-terminates a page whose last row has none, so rows do not fuse", () => {
    // Without this, "1,2" + "3,4" would produce the row "1,23,4".
    expect(concatCsvPages(["a,b\n1,2", "a,b\n3,4\n"])).toBe("a,b\n1,2\n3,4\n");
  });

  it("drops a page that is nothing but a header row", () => {
    expect(concatCsvPages(["a,b\n1,2\n", "a,b\n"])).toBe("a,b\n1,2\n");
  });

  it("survives an empty export", () => {
    expect(concatCsvPages([])).toBe("");
    expect(concatCsvPages(["", ""])).toBe("");
  });

  it("returns a single page untouched", () => {
    expect(concatCsvPages(["a,b\n1,2\n"])).toBe("a,b\n1,2\n");
  });
});
